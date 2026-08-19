export { Ga4Connector } from "./connector.js";
export type {
  Ga4ApiClient,
  Ga4ConnectorOptions,
  Ga4RunReportRequest,
  Ga4RunReportResponse,
} from "./connector.js";
export { resolveGa4Credentials } from "./credentials.js";
export type { Ga4Credentials } from "./credentials.js";
export { mapQualityFlags } from "./quality-flags.js";
export type { Ga4ResponseMetadata } from "./quality-flags.js";
export { createGoogleGa4Client } from "./google-client.js";
export {
  RESERVED_PARAMETERS,
  RESERVED_PARAMETER_REGISTRY_VERSION,
  resolveParameterState,
} from "./reserved-parameter-registry.js";
export type { CustomDimensionLookup } from "./reserved-parameter-registry.js";
export {
  MANAGED_EVENTS,
  MANAGED_EVENT_REGISTRY_VERSION,
  resolveGa4ManagedState,
} from "./managed-event-registry.js";
export {
  buildHealthItemForDetectedEvent,
  computeReviewReason,
  resolveGa4ObservationState,
} from "./health-engine.js";
