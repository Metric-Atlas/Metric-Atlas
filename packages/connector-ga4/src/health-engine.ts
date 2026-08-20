import type {
  AnalyticsHealthReport,
  DetectedEvent,
  EventManifest,
  Ga4ObservationState,
  HealthItem,
  HealthSummary,
  ResultStatus,
} from "@metric-atlas/contracts";
import { classifyHealthItemBucket } from "@metric-atlas/contracts";
import type {
  AnalyticsConnector,
  ConnectorContext,
  DateRange,
  Ga4ObservedEventsResult,
  NormalizedAnalyticsResult,
} from "@metric-atlas/connector-sdk";
import { resolveGa4ManagedState } from "./managed-event-registry.js";
import { resolveParameterState, type CustomDimensionLookup } from "./reserved-parameter-registry.js";

/**
 * DEC-023 / Spike §3: no_rows는 API 오류가 아니라 정상 응답(rowCount=0)이므로 "확실히 관측 안 됨"이다.
 * unauthorized/unsupported/error는 GA4에 실제로 데이터가 있는지 판단할 수 없으므로 unknown.
 */
export function resolveGa4ObservationState(resultStatus: ResultStatus): Ga4ObservationState {
  if (resultStatus === "ok") return "observed";
  if (resultStatus === "no_rows") return "not_observed";
  return "unknown";
}

/**
 * ADR-006 reviewReason 코드 규칙 — 딱 두 코드만 쓴다: `parameter_registration_gap`,
 * `code_only_recent_data` (apps/demo-react-vite/src/labels.ts의 REVIEW_KO에 이미 있는
 * 두 키와 정확히 일치, fixtures/mock-ga4-health.json 예시로 확정된 관례).
 *
 * quality flag(thresholding/other_row/recent)는 reviewReason과 무관하게 항상
 * EventDetail에서 qualityFlags 배열을 통해 FLAG_KO로 별도 렌더링된다(labels.ts 확인).
 * 그래서 reviewReason에 flag 기반 코드를 추가로 넣으면 (a) REVIEW_KO에 없는 키라
 * EventCard/OverviewView에서 "검토 사유 없음"으로 잘못 표시되고 (b) EventDetail에서는
 * 같은 문구가 중복 표시된다. 두 established 코드 외에는 전부 null을 반환해
 * UI(labels.ts REVIEW_KO)가 확장되기 전까지 이 계약을 어기지 않는다.
 */
export function computeReviewReason(
  item: Pick<HealthItem, "codeState" | "ga4ObservationState" | "ga4ManagedState" | "parameterRegistrationStates">,
  qualityFlags: readonly string[],
): string | null {
  // eventKey/eventName은 classifyHealthItemBucket이 읽지 않는 필드라 더미로 채운다.
  const bucket = classifyHealthItemBucket({ eventKey: "", eventName: "", ...item });

  if (bucket === "parameterRegistrationGap") return "parameter_registration_gap";
  if (bucket === "codeOnly" && qualityFlags.includes("recent_data_may_change")) {
    return "code_only_recent_data";
  }
  return null;
}

/**
 * docs/20 §3: 같은 eventKey가 여러 구현(DetectedEvent)에 나타나면 Consumer는
 * eventKey로 묶는다. HealthItem은 논리 이벤트 단위이므로 구현들의 parameters를
 * 합집합(등장 순서 유지)한 형태로 전달받는다. DetectedEvent 하나를 그대로
 * 넘겨도 된다 (구현이 1개인 경우).
 */
export type LogicalGa4Event = Pick<DetectedEvent, "eventKey" | "eventName" | "parameters">;

export function buildHealthItemForDetectedEvent(input: {
  /** analyticsProvider="ga4"인 이벤트만 전달한다 (DEC-033 scope). */
  event: LogicalGa4Event;
  /** event.eventName에 대한 metric="event_count" 조회 결과. */
  queryResult: NormalizedAnalyticsResult;
  customDimensions: CustomDimensionLookup;
}): HealthItem {
  const { event, queryResult, customDimensions } = input;
  const ga4ObservationState = resolveGa4ObservationState(queryResult.resultStatus);
  const ga4ManagedState = resolveGa4ManagedState(event.eventName);
  const parameterRegistrationStates = event.parameters.map((parameter) => ({
    parameter,
    state: resolveParameterState(parameter, customDimensions),
  }));

  const reviewReason = computeReviewReason(
    { codeState: "detected", ga4ObservationState, ga4ManagedState, parameterRegistrationStates },
    queryResult.qualityFlags,
  );

  return {
    eventKey: event.eventKey,
    eventName: event.eventName,
    codeState: "detected",
    ga4ObservationState,
    ga4ManagedState,
    parameterRegistrationStates,
    latestMeasurement: {
      resultStatus: queryResult.resultStatus,
      value: queryResult.value,
      qualityFlags: queryResult.qualityFlags,
    },
    reviewReason,
  };
}

/**
 * ADR-007: "GA4 only" 판정 — GA4가 관측한 이벤트 중 Manifest(GA4-scope DetectedEvent)에
 * 없는 이름들을 codeState="not_detected" HealthItem으로 만든다.
 *
 * eventKey는 Manifest가 없어 B의 채번 규칙을 쓸 수 없으므로, 기존 fixture 전체에서
 * 일관되게 관찰되는 `${provider}:${eventName}` 관례를 그대로 따른다 (예: "ga4:page_view").
 * parameterRegistrationStates는 코드가 없어 판정할 파라미터 자체가 없으므로 항상 빈 배열이다.
 * listObservedEventNames()는 event별 eventCount를 반환하지 않아(ADR-007 승인 스키마) value는
 * 채우지 않는다 — 필요해지면 이름별로 query()를 추가 호출하는 후속 개선으로 남긴다.
 */
export function buildHealthItemsForGa4OnlyEvents(input: {
  /** analyticsProvider="ga4"인 Manifest DetectedEvent들의 eventName 집합 (DEC-033 scope). */
  manifestEventNames: ReadonlySet<string>;
  observedEvents: Ga4ObservedEventsResult;
}): HealthItem[] {
  const { manifestEventNames, observedEvents } = input;
  if (observedEvents.resultStatus !== "ok") return [];

  return observedEvents.eventNames
    .filter((eventName) => !manifestEventNames.has(eventName))
    .map((eventName) => ({
      eventKey: `ga4:${eventName}`,
      eventName,
      codeState: "not_detected",
      ga4ObservationState: "observed",
      ga4ManagedState: resolveGa4ManagedState(eventName),
      parameterRegistrationStates: [],
      latestMeasurement: {
        resultStatus: observedEvents.resultStatus,
        qualityFlags: observedEvents.qualityFlags,
      },
      // ga4Only/ga4Managed 버킷은 REVIEW_KO에 코드가 없어 항상 null (computeReviewReason과 동일 관례).
      reviewReason: null,
    }));
}

/**
 * Manifest + Connector + Registry를 조합해 실제 AnalyticsHealthReport를 만든다
 * (docs/06 §2, docs/20 §5). analyticsProvider="ga4"인 Manifest 이벤트만 대상으로
 * 한다(DEC-033). `customDimensions`는 호출자가 `Ga4Connector.getCustomDimensionLookup()`
 * 으로 한 번 조회해 넘긴다 — Property당 자주 안 바뀌는 값을 이벤트마다 다시 조회하지 않기 위함.
 *
 * dateRange는 절대 날짜여야 한다 — preset 해석은 아직 Connector가 지원하지 않아
 * (connector.ts asAbsolute) preset을 넘기면 모든 항목이 unresolved가 된다.
 */
export async function buildAnalyticsHealthReport(input: {
  connector: AnalyticsConnector;
  context: ConnectorContext;
  manifest: EventManifest;
  dateRange: DateRange;
  customDimensions: CustomDimensionLookup;
  reportingTimezone: string;
  now?: () => Date;
}): Promise<AnalyticsHealthReport> {
  const { connector, context, manifest, dateRange, customDimensions, reportingTimezone } = input;
  const now = input.now ?? (() => new Date());

  // GA4 Health는 analyticsProvider="ga4" Manifest 이벤트만 다룬다 (DEC-033).
  const ga4Events = manifest.events.filter((event) => event.analyticsProvider === "ga4");
  const manifestEventNames = new Set(ga4Events.map((event) => event.eventName));

  // docs/20 §3: HealthItem은 논리 이벤트(eventKey) 단위 — 구현이 여러 곳이어도
  // 1개 아이템으로 집계하고(parameters는 합집합), 같은 eventName의 GA4 중복 조회를 막는다.
  const logicalEvents = new Map<string, LogicalGa4Event>();
  for (const event of ga4Events) {
    const existing = logicalEvents.get(event.eventKey);
    if (!existing) {
      logicalEvents.set(event.eventKey, {
        eventKey: event.eventKey,
        eventName: event.eventName,
        parameters: [...event.parameters],
      });
      continue;
    }
    for (const parameter of event.parameters) {
      if (!existing.parameters.includes(parameter)) existing.parameters.push(parameter);
    }
  }

  const detectedItems = await Promise.all(
    [...logicalEvents.values()].map(async (event) => {
      const queryResult = await connector.query(context, {
        eventKey: event.eventKey,
        eventName: event.eventName,
        metric: "event_count",
        dateRange,
      });
      return buildHealthItemForDetectedEvent({ event, queryResult, customDimensions });
    }),
  );

  const observedEvents = await connector.listObservedEventNames(context, dateRange);
  const ga4OnlyItems = buildHealthItemsForGa4OnlyEvents({ manifestEventNames, observedEvents });

  const items = [...detectedItems, ...ga4OnlyItems];

  const summary: HealthSummary = {
    healthy: 0,
    codeOnly: 0,
    ga4Only: 0,
    ga4Managed: 0,
    parameterRegistrationGap: 0,
    unresolved: 0,
  };
  for (const item of items) summary[classifyHealthItemBucket(item)] += 1;

  // docs/20 §5: DYNAMIC_EVENT_NAME 경고는 events[]에 없어 위 루프로 안 잡히므로 별도 합산한다.
  summary.unresolved += manifest.warnings.filter((w) => w.code === "DYNAMIC_EVENT_NAME").length;

  return {
    generatedAt: now().toISOString(),
    provider: "ga4",
    propertyId: context.propertyId,
    reportingTimezone,
    summary,
    items,
  };
}
