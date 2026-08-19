import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { v1beta as adminV1beta } from "@google-analytics/admin";
import type {
  Ga4ApiClient,
  Ga4CustomDimension,
  Ga4ListEventNamesRequest,
  Ga4RunReportRequest,
  Ga4RunReportResponse,
} from "./connector.js";
import type { Ga4Credentials } from "./credentials.js";

/**
 * 실제 GA4 API 어댑터 — 네트워크 경계이므로 unit test 대상이 아니며
 * 호출 형태는 Spike(C-SPIKE-001) 스크립트로 실측 검증됨.
 * 클라이언트 인스턴스는 생성 후 재사용한다 (호출당 재생성 금지).
 */
export function createGoogleGa4Client(credentials: Ga4Credentials): Ga4ApiClient {
  const clientOptions =
    credentials.type === "inline_json"
      ? { credentials: credentials.credentials }
      : { keyFilename: credentials.path };

  const data = new BetaAnalyticsDataClient(clientOptions);
  const admin = new adminV1beta.AnalyticsAdminServiceClient(clientOptions);

  return {
    async runReport(request: Ga4RunReportRequest): Promise<Ga4RunReportResponse> {
      const [response] = await data.runReport({
        property: `properties/${request.propertyId}`,
        dateRanges: request.dateRanges,
        metrics: [{ name: "eventCount" }],
        dimensionFilter: {
          filter: {
            fieldName: "eventName",
            stringFilter: { matchType: "EXACT", value: request.eventName },
          },
        },
      });
      return {
        rowCount: response.rowCount ?? 0,
        rows: (response.rows ?? []).map((row) => ({
          dimensionValues: row.dimensionValues ?? undefined,
          metricValues: row.metricValues ?? undefined,
        })),
        metadata: {
          subjectToThresholding: response.metadata?.subjectToThresholding,
          dataLossFromOtherRow: response.metadata?.dataLossFromOtherRow,
        },
      };
    },

    async listEventNames(request: Ga4ListEventNamesRequest): Promise<Ga4RunReportResponse> {
      const [response] = await data.runReport({
        property: `properties/${request.propertyId}`,
        dateRanges: request.dateRanges,
        dimensions: [{ name: "eventName" }],
        metrics: [{ name: "eventCount" }],
      });
      return {
        rowCount: response.rowCount ?? 0,
        rows: (response.rows ?? []).map((row) => ({
          dimensionValues: row.dimensionValues ?? undefined,
          metricValues: row.metricValues ?? undefined,
        })),
        metadata: {
          subjectToThresholding: response.metadata?.subjectToThresholding,
          dataLossFromOtherRow: response.metadata?.dataLossFromOtherRow,
        },
      };
    },

    async getPropertyTimezone(propertyId: string): Promise<string | undefined> {
      const [property] = await admin.getProperty({ name: `properties/${propertyId}` });
      return property.timeZone ?? undefined;
    },

    async listCustomDimensions(propertyId: string): Promise<Ga4CustomDimension[]> {
      const [dimensions] = await admin.listCustomDimensions({
        parent: `properties/${propertyId}`,
      });
      return dimensions
        .filter((d) => Boolean(d.parameterName))
        .map((d) => ({ parameterName: d.parameterName as string, scope: String(d.scope ?? "") }));
    },
  };
}
