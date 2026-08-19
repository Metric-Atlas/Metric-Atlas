import type {
  AnalyticsConnector,
  ConnectionResult,
  ConnectorCapabilities,
  ConnectorContext,
  DataQualityFlag,
  DateRange,
  Ga4ObservedEventsResult,
  NormalizedAnalyticsResult,
  ProviderAgnosticQuery,
} from "@metric-atlas/connector-sdk";
import { mapQualityFlags, type Ga4ResponseMetadata } from "./quality-flags.js";
import type { CustomDimensionLookup } from "./reserved-parameter-registry.js";

export interface Ga4RunReportRequest {
  propertyId: string;
  eventName: string;
  dateRanges: Array<{ startDate: string; endDate: string }>;
}

export interface Ga4ListEventNamesRequest {
  propertyId: string;
  dateRanges: Array<{ startDate: string; endDate: string }>;
}

export interface Ga4RunReportResponse {
  rowCount: number;
  rows: Array<{
    dimensionValues?: Array<{ value?: string | null }> | undefined;
    metricValues?: Array<{ value?: string | null }> | undefined;
  }>;
  metadata: Ga4ResponseMetadata;
}

export interface Ga4CustomDimension {
  parameterName: string;
  scope: string;
}

/** 실제 GA4 클라이언트를 감싸는 최소 인터페이스 — 테스트에서 fake 주입 */
export interface Ga4ApiClient {
  runReport(request: Ga4RunReportRequest): Promise<Ga4RunReportResponse>;
  /** ADR-007: eventName 필터 없이 eventName dimension으로 breakdown 조회 (GA4-only 판정용). */
  listEventNames(request: Ga4ListEventNamesRequest): Promise<Ga4RunReportResponse>;
  /** Admin API listCustomDimensions (Spike §5, docs/06 §6 Custom Dimension Gap). */
  listCustomDimensions(propertyId: string): Promise<Ga4CustomDimension[]>;
  getPropertyTimezone(propertyId: string): Promise<string | undefined>;
}

export interface Ga4ConnectorOptions {
  recentWindowHours: number;
  now?: () => Date;
}

const GRPC_PERMISSION_DENIED = 7;
const GRPC_UNAUTHENTICATED = 16;

type AbsoluteRange = { startDate: string; endDate: string };

function asAbsolute(range: DateRange): AbsoluteRange | undefined {
  // preset 해석은 Property timezone 기준 날짜 계산이 필요해 후속 태스크 범위
  return range.startDate && range.endDate
    ? { startDate: range.startDate, endDate: range.endDate }
    : undefined;
}

function toErrorCode(error: unknown): string {
  const code = (error as { code?: number }).code;
  if (code === GRPC_PERMISSION_DENIED || code === GRPC_UNAUTHENTICATED) return "unauthorized";
  return "error";
}

function metricNumber(row: Ga4RunReportResponse["rows"][number] | undefined): number | undefined {
  const raw = row?.metricValues?.[0]?.value;
  return raw == null ? undefined : Number(raw);
}

export class Ga4Connector implements AnalyticsConnector {
  private timezoneCache = new Map<string, string>();
  private customDimensionCache = new Map<string, ReadonlySet<string>>();

  constructor(
    private readonly client: Ga4ApiClient,
    private readonly options: Ga4ConnectorOptions,
  ) {}

  async testConnection(context: ConnectorContext): Promise<ConnectionResult> {
    try {
      const reportingTimezone = await this.resolveTimezone(context.propertyId);
      return { success: true, provider: "ga4", propertyId: context.propertyId, reportingTimezone };
    } catch (error) {
      return {
        success: false,
        provider: "ga4",
        propertyId: context.propertyId,
        errorCode: toErrorCode(error),
      };
    }
  }

  async query(
    context: ConnectorContext,
    query: ProviderAgnosticQuery,
  ): Promise<NormalizedAnalyticsResult> {
    const range = asAbsolute(query.dateRange);
    if (!range) return this.result(context, query, "unsupported", "");
    if (query.metric !== "event_count" && query.metric !== "comparison") {
      return this.result(context, query, "unsupported", "");
    }
    const comparisonRange = query.comparisonRange && asAbsolute(query.comparisonRange);
    if (query.metric === "comparison" && !comparisonRange) {
      return this.result(context, query, "unsupported", "");
    }

    let timezone = "";
    try {
      timezone = await this.resolveTimezone(context.propertyId);
      const response = await this.client.runReport({
        propertyId: context.propertyId,
        eventName: query.eventName,
        dateRanges: comparisonRange ? [range, comparisonRange] : [range],
      });

      const flags = mapQualityFlags({
        metadata: response.metadata,
        endDate: range.endDate,
        now: this.now(),
        recentWindowHours: this.options.recentWindowHours,
      });

      if (response.rowCount === 0) {
        return this.result(context, query, "no_rows", timezone, { qualityFlags: flags });
      }

      if (comparisonRange) {
        // 복수 dateRange 조회 시 GA4가 dateRange dimension(date_range_N)을 자동 추가
        const byRange = (suffix: string) =>
          response.rows.find((row) =>
            row.dimensionValues?.some((d) => d.value === `date_range_${suffix}`),
          );
        return this.result(context, query, "ok", timezone, {
          value: metricNumber(byRange("0")),
          previousValue: metricNumber(byRange("1")),
          qualityFlags: flags,
          comparisonDateRange: comparisonRange,
        });
      }

      return this.result(context, query, "ok", timezone, {
        value: metricNumber(response.rows[0]),
        qualityFlags: flags,
      });
    } catch (error) {
      return this.result(
        context,
        query,
        toErrorCode(error) === "unauthorized" ? "unauthorized" : "error",
        timezone,
      );
    }
  }

  capabilities(): ConnectorCapabilities {
    return {
      supportedMetrics: ["event_count", "comparison"],
      supportedDimensions: [],
      comparisonSupport: true,
      adminMetadataSupport: true,
      eventListingSupport: true,
    };
  }

  async listObservedEventNames(
    context: ConnectorContext,
    dateRange: DateRange,
  ): Promise<Ga4ObservedEventsResult> {
    const range = asAbsolute(dateRange);
    if (!range) return { resultStatus: "unsupported", eventNames: [], qualityFlags: [] };

    try {
      const response = await this.client.listEventNames({
        propertyId: context.propertyId,
        dateRanges: [range],
      });

      const flags = mapQualityFlags({
        metadata: response.metadata,
        endDate: range.endDate,
        now: this.now(),
        recentWindowHours: this.options.recentWindowHours,
      });

      if (response.rowCount === 0) {
        return { resultStatus: "no_rows", eventNames: [], qualityFlags: flags };
      }

      const eventNames = response.rows
        .map((row) => row.dimensionValues?.[0]?.value)
        .filter((name): name is string => typeof name === "string" && name.length > 0);

      return { resultStatus: "ok", eventNames, qualityFlags: flags };
    } catch (error) {
      return {
        resultStatus: toErrorCode(error) === "unauthorized" ? "unauthorized" : "error",
        eventNames: [],
        qualityFlags: [],
      };
    }
  }

  /**
   * Spike §5 / docs/06 §6 Custom Dimension Gap 판정 입력. Admin `listCustomDimensions`가
   * 실패하면 status="unknown"(등록 0건과 구분, resolveParameterState가 그대로 unknown 처리).
   * Property 등록 목록은 세션 중 자주 안 바뀌므로 timezone과 같은 방식으로 캐시한다.
   */
  async getCustomDimensionLookup(context: ConnectorContext): Promise<CustomDimensionLookup> {
    const cached = this.customDimensionCache.get(context.propertyId);
    if (cached) return { status: "ok", registeredParameterNames: cached };

    try {
      const dimensions = await this.client.listCustomDimensions(context.propertyId);
      const registeredParameterNames = new Set(dimensions.map((d) => d.parameterName));
      this.customDimensionCache.set(context.propertyId, registeredParameterNames);
      return { status: "ok", registeredParameterNames };
    } catch {
      return { status: "unknown" };
    }
  }

  private async resolveTimezone(propertyId: string): Promise<string> {
    const cached = this.timezoneCache.get(propertyId);
    if (cached) return cached;
    const timezone = (await this.client.getPropertyTimezone(propertyId)) ?? "";
    if (timezone) this.timezoneCache.set(propertyId, timezone);
    return timezone;
  }

  private now(): Date {
    return this.options.now?.() ?? new Date();
  }

  private result(
    context: ConnectorContext,
    query: ProviderAgnosticQuery,
    resultStatus: NormalizedAnalyticsResult["resultStatus"],
    reportingTimezone: string,
    extra: {
      value?: number | undefined;
      previousValue?: number | undefined;
      qualityFlags?: DataQualityFlag[] | undefined;
      comparisonDateRange?: DateRange | undefined;
    } = {},
  ): NormalizedAnalyticsResult {
    return {
      provider: "ga4",
      eventKey: query.eventKey,
      metricType: query.metric,
      resultStatus,
      value: extra.value,
      previousValue: extra.previousValue,
      dateRange: query.dateRange,
      comparisonDateRange: extra.comparisonDateRange,
      reportingTimezone,
      fetchedAt: this.now().toISOString(),
      qualityFlags: extra.qualityFlags ?? [],
    };
  }
}
