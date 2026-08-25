import type {
  AnalyticsHealthReport,
  DetectedEvent,
  ElementBinding,
  EventManifest,
  HealthItem as ContractHealthItem,
  ProviderDetectionConfidence as ContractProviderDetectionConfidence,
} from "@metric-atlas/contracts";

export type ProviderDetectionConfidence = ContractProviderDetectionConfidence;
export type ManifestEvent = DetectedEvent;
export type ManifestBinding = ElementBinding;
export type Manifest = EventManifest;
export type HealthItem = ContractHealthItem;
export type Ga4Health = AnalyticsHealthReport;

export type HealthBucket =
  | "healthy"
  | "codeOnly"
  | "ga4Only"
  | "ga4Managed"
  | "parameterRegistrationGap"
  | "unresolved"
  | "noHealth";

/** Manifest event joined with its GA4 health item by eventKey. */
export interface JoinedRow {
  eventKey: string;
  eventName: string;
  event: ManifestEvent | null;
  health: HealthItem | null;
  bindings: ManifestBinding[];
  bucket: HealthBucket;
  gtmRoute: GtmRoute | null;
}

export interface GtmRoute {
  eventKey: string;
  gtmEventName: string;
  triggerName: string;
  tagName: string;
  destinationProvider: "ga4" | "unknown";
  destinationEventName: string;
  measurementId?: string;
  confidence: "exact" | "unresolved";
}

export type AnalysisType = "definition" | "event_count" | "comparison";

export interface QueryPlanDraft {
  version: "1";
  analysisType: AnalysisType;
  eventKeys: string[];
  dateRange?: { preset: string };
  comparisonRange?: { preset: string };
  filters: unknown[];
  breakdowns: unknown[];
  sourceRefs: string[];
  assumptions: unknown[];
}

export interface QueryOutcome {
  plan: QueryPlanDraft;
  blocked: boolean;
  /** "실행 가능" | "실행 차단" | "실행 불필요" */
  statusLabel: string;
  statusReason: string;
  result: null | {
    value: string;
    previousValue?: string;
    dateRange: string;
    comparisonDateRange?: string;
    deltaPercent?: number;
    resultStatus: string;
    reportingTimezone: string;
    fetchedAt: string;
  };
  noResultReason: string;
}

/**
 * "대화모드"는 후보가 확정되는 즉시 LLM 설명을 자동 요청한다.
 * "분석모드"는 QueryPlan/Mock 결과만 계산하고 LLM은 수동 버튼으로만 호출한다.
 */
export type QueryMode = "chat" | "analysis";

export type QueryScope = "event" | "health_summary";

export type LlmState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; message: string; model: string; provider: string }
  | { status: "error"; message: string; code: string };

/** "이벤트 탐색" 화면에서 "질의로 보내기"를 눌렀을 때 QueryView에 넘기는 시작 질문. */
export interface QuerySeed {
  question: string;
  eventKey: string;
}

/** 채팅형 질의 화면의 한 턴. candidates/chosenKey는 이 턴이 생성된 시점의 질문으로 고정된다. */
export interface QueryTurn {
  id: string;
  question: string;
  mode: QueryMode;
  scope: QueryScope;
  analysisType: AnalysisType;
  candidates: JoinedRow[];
  chosenKey: string | null;
  llm: LlmState;
}
