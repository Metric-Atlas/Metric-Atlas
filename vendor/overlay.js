var __defProp = Object.defineProperty;
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);

// packages/contracts/dist/common.js
import { z } from "zod";
var AnalyticsProvider = z.enum([
  "ga4",
  "mixpanel",
  "meta",
  "posthog",
  "amplitude",
  "unknown"
]);
var TrackingEmitter = z.enum([
  "ga4",
  "gtm",
  "mixpanel",
  "meta",
  "posthog",
  "amplitude",
  "custom",
  "unknown"
]);
var ProviderDetectionConfidence = z.enum([
  "provider_exact",
  "provider_configured",
  "provider_unknown"
]);
var BindingConfidence = z.enum([
  "binding_exact",
  "binding_inferred",
  "binding_unresolved"
]);
var CodeState = z.enum(["detected", "not_detected", "unknown"]);
var Ga4ObservationState = z.enum([
  "observed",
  "not_observed",
  "unknown"
]);
var Ga4ManagedState = z.enum(["managed", "not_managed", "unknown"]);
var ParameterState = z.enum([
  "builtin",
  "registered_custom_dimension",
  "not_registered",
  "unknown"
]);
var ResultStatus = z.enum([
  "ok",
  "no_rows",
  "unauthorized",
  "unsupported",
  "error"
]);
var DataQualityFlag = z.enum([
  "subject_to_thresholding",
  "other_row_data_loss",
  "recent_data_may_change"
]);
var MetricType = z.enum(["event_count", "comparison", "custom"]);
var PresetDateRange = z.object({
  preset: z.string(),
  startDate: z.never().optional(),
  endDate: z.never().optional()
});
var AbsoluteDateRange = z.object({
  preset: z.never().optional(),
  startDate: z.string(),
  endDate: z.string()
});
var DateRange = z.union([PresetDateRange, AbsoluteDateRange]);
var SourceLocation = z.object({
  file: z.string(),
  line: z.number().int().positive(),
  column: z.number().int().positive().optional()
});
var ElementLocation = z.object({
  type: z.string(),
  file: z.string(),
  line: z.number().int().positive(),
  column: z.number().int().positive().optional()
});
var ScanWarning = z.object({
  code: z.string(),
  file: z.string().optional(),
  line: z.number().int().positive().optional(),
  message: z.string().optional(),
  relatedImplementationKey: z.string().optional()
});

// packages/contracts/dist/manifest.js
import { z as z2 } from "zod";
var DetectedEvent = z2.object({
  eventKey: z2.string(),
  implementationKey: z2.string(),
  eventName: z2.string(),
  emitter: TrackingEmitter,
  analyticsProvider: AnalyticsProvider,
  providerDetectionConfidence: ProviderDetectionConfidence,
  parameters: z2.array(z2.string()),
  source: SourceLocation,
  overlaySupported: z2.boolean()
});
var ElementBinding = z2.object({
  atlasDomId: z2.string(),
  eventKeys: z2.array(z2.string()).min(1),
  implementationKeys: z2.array(z2.string()).min(1),
  element: ElementLocation,
  bindingConfidence: BindingConfidence
});
var NamedCount = z2.object({
  name: z2.string(),
  eventCount: z2.number().int().nonnegative()
});
var ManifestSummaries = z2.object({
  emitters: z2.array(NamedCount),
  analyticsProviders: z2.array(NamedCount)
});
var ScanStats = z2.object({
  filesScanned: z2.number().int().nonnegative(),
  durationMs: z2.number().nonnegative(),
  eventsDetected: z2.number().int().nonnegative()
});
var EventManifest = z2.object({
  version: z2.string(),
  buildId: z2.string(),
  generatedAt: z2.string(),
  events: z2.array(DetectedEvent),
  bindings: z2.array(ElementBinding),
  warnings: z2.array(ScanWarning),
  summaries: ManifestSummaries.optional(),
  scanStats: ScanStats.optional()
});

// packages/contracts/dist/health.js
import { z as z3 } from "zod";
var ParameterRegistrationState = z3.object({
  parameter: z3.string(),
  state: ParameterState
});
var LatestMeasurement = z3.object({
  resultStatus: ResultStatus,
  value: z3.number().optional(),
  qualityFlags: z3.array(DataQualityFlag)
});
var HealthItem = z3.object({
  eventKey: z3.string(),
  eventName: z3.string(),
  codeState: CodeState,
  ga4ObservationState: Ga4ObservationState,
  ga4ManagedState: Ga4ManagedState,
  parameterRegistrationStates: z3.array(ParameterRegistrationState),
  latestMeasurement: LatestMeasurement.optional(),
  reviewReason: z3.string().nullable().optional()
});
var HealthSummary = z3.object({
  healthy: z3.number().int().nonnegative(),
  codeOnly: z3.number().int().nonnegative(),
  ga4Only: z3.number().int().nonnegative(),
  ga4Managed: z3.number().int().nonnegative(),
  parameterRegistrationGap: z3.number().int().nonnegative(),
  unresolved: z3.number().int().nonnegative()
});
var AnalyticsHealthReport = z3.object({
  generatedAt: z3.string(),
  provider: AnalyticsProvider,
  propertyId: z3.string(),
  reportingTimezone: z3.string(),
  summary: HealthSummary,
  items: z3.array(HealthItem)
});

// packages/contracts/dist/query.js
import { z as z4 } from "zod";
var QueryResult = z4.object({
  provider: AnalyticsProvider,
  eventKey: z4.string(),
  metricType: MetricType,
  resultStatus: ResultStatus,
  value: z4.number().optional(),
  previousValue: z4.number().optional(),
  dateRange: DateRange,
  comparisonDateRange: DateRange.optional(),
  reportingTimezone: z4.string(),
  fetchedAt: z4.string(),
  qualityFlags: z4.array(DataQualityFlag)
}).refine((result) => result.metricType !== "comparison" || result.resultStatus !== "ok" || result.comparisonDateRange !== void 0, {
  message: 'comparisonDateRange is required when metricType is "comparison" and resultStatus is "ok"',
  path: ["comparisonDateRange"]
});
var QueryPlan = z4.object({
  version: z4.string(),
  analysisType: z4.enum(["definition", "event_count", "comparison"]),
  eventKeys: z4.array(z4.string()),
  dateRange: DateRange,
  comparisonRange: DateRange.optional(),
  filters: z4.array(z4.unknown()),
  breakdowns: z4.array(z4.unknown()),
  sourceRefs: z4.array(z4.string()),
  assumptions: z4.array(z4.unknown())
});
var MockQueryFixture = z4.object({
  queryPlan: QueryPlan,
  result: QueryResult
});

// packages/contracts/dist/connector.js
import { z as z5 } from "zod";
var ConnectorContext = z5.object({
  provider: AnalyticsProvider,
  propertyId: z5.string(),
  credentialRef: z5.string()
});
var ConnectionResult = z5.object({
  success: z5.boolean(),
  provider: AnalyticsProvider,
  propertyId: z5.string(),
  reportingTimezone: z5.string().optional(),
  errorCode: z5.string().optional()
});
var ProviderAgnosticQuery = z5.object({
  eventKey: z5.string().optional(),
  eventName: z5.string(),
  metric: MetricType,
  dateRange: DateRange,
  comparisonRange: DateRange.optional(),
  breakdowns: z5.array(z5.string()).optional(),
  filters: z5.record(z5.string()).optional()
}).refine((query) => query.metric !== "comparison" || query.comparisonRange !== void 0, {
  message: 'comparisonRange is required when metric is "comparison"',
  path: ["comparisonRange"]
});
var ConnectorCapabilities = z5.object({
  supportedMetrics: z5.array(MetricType),
  supportedDimensions: z5.array(z5.string()),
  comparisonSupport: z5.boolean(),
  adminMetadataSupport: z5.boolean(),
  /** ADR-007: supports listObservedEventNames() for "GA4 only" Health detection. */
  eventListingSupport: z5.boolean()
});
var Ga4ObservedEventsResult = z5.object({
  resultStatus: ResultStatus,
  eventNames: z5.array(z5.string()),
  qualityFlags: z5.array(DataQualityFlag)
});
var NormalizedAnalyticsResult = z5.object({
  provider: z5.literal("ga4"),
  eventKey: z5.string().optional(),
  metricType: MetricType,
  resultStatus: ResultStatus,
  value: z5.number().optional(),
  previousValue: z5.number().optional(),
  dateRange: DateRange,
  comparisonDateRange: DateRange.optional(),
  reportingTimezone: z5.string(),
  fetchedAt: z5.string(),
  qualityFlags: z5.array(DataQualityFlag),
  providerMetadata: z5.record(z5.unknown()).optional()
}).refine((result) => result.metricType !== "comparison" || result.resultStatus !== "ok" || result.comparisonDateRange !== void 0, {
  message: 'comparisonDateRange is required when metricType is "comparison" and resultStatus is "ok"',
  path: ["comparisonDateRange"]
});

// packages/overlay/dist/index.js
var METRIC_ATLAS_OVERLAY_TAG = "metric-atlas-overlay";
var template = document.createElement("template");
template.innerHTML = `
  <style>
    :host { all: initial; color-scheme: dark; }
    #launcher {
      position: fixed; right: 18px; bottom: 18px; z-index: 2147483646;
      width: 44px; height: 44px; border: 0; border-radius: 999px;
      color: #fff; background: #2563eb; box-shadow: 0 8px 28px #0005;
      font: 700 13px/1 system-ui, sans-serif; cursor: pointer;
    }
    #panel {
      position: fixed; right: 18px; bottom: 72px; z-index: 2147483646;
      box-sizing: border-box; width: min(390px, calc(100vw - 36px)); max-height: min(520px, calc(100vh - 100px));
      overflow: auto; padding: 14px; border: 1px solid #334155; border-radius: 12px;
      color: #e2e8f0; background: #0f172af2; box-shadow: 0 18px 45px #0007;
      font: 13px/1.45 system-ui, sans-serif;
    }
    #panel[hidden] { display: none; }
    .header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    h2 { margin: 0; color: #fff; font-size: 15px; }
    #status { color: #94a3b8; font-size: 11px; }
    #details { margin-top: 12px; }
    .empty { color: #94a3b8; }
    .event { padding: 10px 0; border-top: 1px solid #334155; }
    .name { color: #f8fafc; font-weight: 700; overflow-wrap: anywhere; }
    .badges { display: flex; flex-wrap: wrap; gap: 5px; margin: 6px 0; }
    .badge { padding: 2px 6px; border-radius: 999px; background: #1e3a8a; color: #dbeafe; font-size: 11px; }
    .source, .parameters { color: #cbd5e1; overflow-wrap: anywhere; }
  </style>
  <button id="launcher" type="button" aria-expanded="false" aria-controls="panel" title="Toggle Metric Atlas overlay">MA</button>
  <section id="panel" hidden aria-live="polite">
    <div class="header"><h2>Metric Atlas</h2><span id="status">Manifest not loaded</span></div>
    <div id="details"><p class="empty">Turn on the overlay and hover a tracked element.</p></div>
  </section>
`;
var _root, _manifest, _bindingByDomId, _eventsByKey, _enabled, _activeTarget, _previousOutline, _previousOutlineOffset, _MetricAtlasOverlayElement_instances, launcher_get, panel_get, status_get, details_get, _toggle, _onPointerOver, _onPointerOut, highlight_fn, clearHighlight_fn, renderBinding_fn, resetManifest_fn;
var MetricAtlasOverlayElement = class extends HTMLElement {
  constructor() {
    super();
    __privateAdd(this, _MetricAtlasOverlayElement_instances);
    __privateAdd(this, _root);
    __privateAdd(this, _manifest, null);
    __privateAdd(this, _bindingByDomId, /* @__PURE__ */ new Map());
    __privateAdd(this, _eventsByKey, /* @__PURE__ */ new Map());
    __privateAdd(this, _enabled, false);
    __privateAdd(this, _activeTarget, null);
    __privateAdd(this, _previousOutline, "");
    __privateAdd(this, _previousOutlineOffset, "");
    __privateAdd(this, _toggle, () => {
      __privateSet(this, _enabled, !__privateGet(this, _enabled));
      __privateGet(this, _MetricAtlasOverlayElement_instances, panel_get).hidden = !__privateGet(this, _enabled);
      __privateGet(this, _MetricAtlasOverlayElement_instances, launcher_get).setAttribute("aria-expanded", String(__privateGet(this, _enabled)));
      if (!__privateGet(this, _enabled))
        __privateMethod(this, _MetricAtlasOverlayElement_instances, clearHighlight_fn).call(this);
    });
    __privateAdd(this, _onPointerOver, (event) => {
      if (!__privateGet(this, _enabled) || !__privateGet(this, _manifest))
        return;
      const target = event.composedPath().find((candidate) => candidate instanceof HTMLElement)?.closest("[data-atlas-id]");
      if (!target || target === __privateGet(this, _activeTarget))
        return;
      const atlasDomId = target.dataset.atlasId;
      if (!atlasDomId)
        return;
      const binding = __privateGet(this, _bindingByDomId).get(atlasDomId);
      if (!binding)
        return;
      __privateMethod(this, _MetricAtlasOverlayElement_instances, highlight_fn).call(this, target);
      __privateMethod(this, _MetricAtlasOverlayElement_instances, renderBinding_fn).call(this, binding);
    });
    __privateAdd(this, _onPointerOut, (event) => {
      if (!__privateGet(this, _activeTarget))
        return;
      const next = event.relatedTarget;
      if (next instanceof Node && __privateGet(this, _activeTarget).contains(next))
        return;
      __privateMethod(this, _MetricAtlasOverlayElement_instances, clearHighlight_fn).call(this);
    });
    __privateSet(this, _root, this.attachShadow({ mode: "open" }));
    __privateGet(this, _root).append(template.content.cloneNode(true));
  }
  connectedCallback() {
    __privateGet(this, _MetricAtlasOverlayElement_instances, launcher_get).addEventListener("click", __privateGet(this, _toggle));
    document.addEventListener("pointerover", __privateGet(this, _onPointerOver), true);
    document.addEventListener("pointerout", __privateGet(this, _onPointerOut), true);
    if (this.hasAttribute("manifest-url") && !__privateGet(this, _manifest)) {
      void this.loadManifest(this.getAttribute("manifest-url"));
    }
  }
  disconnectedCallback() {
    __privateGet(this, _MetricAtlasOverlayElement_instances, launcher_get).removeEventListener("click", __privateGet(this, _toggle));
    document.removeEventListener("pointerover", __privateGet(this, _onPointerOver), true);
    document.removeEventListener("pointerout", __privateGet(this, _onPointerOut), true);
    __privateMethod(this, _MetricAtlasOverlayElement_instances, clearHighlight_fn).call(this);
  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "manifest-url" && newValue && oldValue !== newValue && this.isConnected) {
      void this.loadManifest(newValue);
    }
  }
  get manifest() {
    return __privateGet(this, _manifest);
  }
  set manifest(value) {
    if (value)
      this.setManifest(value);
    else
      __privateMethod(this, _MetricAtlasOverlayElement_instances, resetManifest_fn).call(this);
  }
  async loadManifest(url) {
    __privateGet(this, _MetricAtlasOverlayElement_instances, status_get).textContent = "Loading manifest\u2026";
    try {
      const response = await fetch(url, { credentials: "same-origin" });
      if (!response.ok)
        throw new Error(`Manifest request failed (${response.status})`);
      const value = await response.json();
      const parsed = EventManifest.safeParse(value);
      if (!parsed.success)
        throw new Error("Manifest response has an invalid shape");
      this.setManifest(parsed.data);
    } catch (error) {
      __privateGet(this, _MetricAtlasOverlayElement_instances, status_get).textContent = error instanceof Error ? error.message : "Manifest load failed";
      this.dispatchEvent(new CustomEvent("metric-atlas:error", {
        detail: error,
        bubbles: true,
        composed: true
      }));
    }
  }
  setManifest(manifest) {
    __privateSet(this, _manifest, manifest);
    __privateSet(this, _bindingByDomId, new Map(manifest.bindings.map((binding) => [binding.atlasDomId, binding])));
    __privateGet(this, _eventsByKey).clear();
    for (const event of manifest.events) {
      const group = __privateGet(this, _eventsByKey).get(event.eventKey) ?? [];
      group.push(event);
      __privateGet(this, _eventsByKey).set(event.eventKey, group);
    }
    const coverage = this.measureCoverage();
    __privateGet(this, _MetricAtlasOverlayElement_instances, status_get).textContent = `${coverage.domMatchedCount}/${coverage.injectCandidateCount} DOM matched`;
    this.dispatchEvent(new CustomEvent("metric-atlas:coverage", {
      detail: coverage,
      bubbles: true,
      composed: true
    }));
    return coverage;
  }
  measureCoverage() {
    const ids = [...__privateGet(this, _bindingByDomId).keys()];
    const domMatchedCount = ids.filter((id) => document.querySelector(`[data-atlas-id="${cssEscape(id)}"]`)).length;
    const injectCandidateCount = ids.length;
    const domMissingCount = injectCandidateCount - domMatchedCount;
    return {
      injectCandidateCount,
      domMatchedCount,
      domMissingCount,
      bindingCoverage: injectCandidateCount === 0 ? 1 : domMatchedCount / injectCandidateCount
    };
  }
};
_root = new WeakMap();
_manifest = new WeakMap();
_bindingByDomId = new WeakMap();
_eventsByKey = new WeakMap();
_enabled = new WeakMap();
_activeTarget = new WeakMap();
_previousOutline = new WeakMap();
_previousOutlineOffset = new WeakMap();
_MetricAtlasOverlayElement_instances = new WeakSet();
launcher_get = function() {
  return __privateGet(this, _root).querySelector("#launcher");
};
panel_get = function() {
  return __privateGet(this, _root).querySelector("#panel");
};
status_get = function() {
  return __privateGet(this, _root).querySelector("#status");
};
details_get = function() {
  return __privateGet(this, _root).querySelector("#details");
};
_toggle = new WeakMap();
_onPointerOver = new WeakMap();
_onPointerOut = new WeakMap();
highlight_fn = function(target) {
  __privateMethod(this, _MetricAtlasOverlayElement_instances, clearHighlight_fn).call(this);
  __privateSet(this, _activeTarget, target);
  __privateSet(this, _previousOutline, target.style.outline);
  __privateSet(this, _previousOutlineOffset, target.style.outlineOffset);
  target.style.outline = "3px solid #2563eb";
  target.style.outlineOffset = "2px";
};
clearHighlight_fn = function() {
  if (!__privateGet(this, _activeTarget))
    return;
  __privateGet(this, _activeTarget).style.outline = __privateGet(this, _previousOutline);
  __privateGet(this, _activeTarget).style.outlineOffset = __privateGet(this, _previousOutlineOffset);
  __privateSet(this, _activeTarget, null);
};
renderBinding_fn = function(binding) {
  const fragment = document.createDocumentFragment();
  const candidates = binding.eventKeys.flatMap((eventKey) => __privateGet(this, _eventsByKey).get(eventKey) ?? []);
  const implementationKeys = new Set(binding.implementationKeys);
  const events = candidates.filter((event) => implementationKeys.has(event.implementationKey));
  for (const event of events) {
    const article = document.createElement("article");
    article.className = "event";
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = event.eventName;
    const badges = document.createElement("div");
    badges.className = "badges";
    badges.append(badge(`Emitter: ${event.emitter}`), badge(`Provider: ${event.analyticsProvider}`));
    const source = document.createElement("div");
    source.className = "source";
    source.textContent = `${event.source.file}:${event.source.line}:${event.source.column ?? 1}`;
    const parameters = document.createElement("div");
    parameters.className = "parameters";
    parameters.textContent = `Parameters: ${event.parameters.join(", ") || "none"}`;
    article.append(name, badges, source, parameters);
    fragment.append(article);
  }
  if (events.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No manifest event matched this binding.";
    fragment.append(empty);
  }
  __privateGet(this, _MetricAtlasOverlayElement_instances, details_get).replaceChildren(fragment);
};
resetManifest_fn = function() {
  __privateSet(this, _manifest, null);
  __privateGet(this, _bindingByDomId).clear();
  __privateGet(this, _eventsByKey).clear();
  __privateGet(this, _MetricAtlasOverlayElement_instances, status_get).textContent = "Manifest not loaded";
};
__publicField(MetricAtlasOverlayElement, "observedAttributes", ["manifest-url"]);
function defineMetricAtlasOverlay() {
  if (!customElements.get(METRIC_ATLAS_OVERLAY_TAG)) {
    customElements.define(METRIC_ATLAS_OVERLAY_TAG, MetricAtlasOverlayElement);
  }
}
function mountMetricAtlasOverlay(options = {}) {
  defineMetricAtlasOverlay();
  const existing = document.querySelector(METRIC_ATLAS_OVERLAY_TAG);
  if (existing) {
    if (options.manifest)
      existing.setManifest(options.manifest);
    if (options.manifestUrl)
      existing.setAttribute("manifest-url", options.manifestUrl);
    return existing;
  }
  const element = document.createElement(METRIC_ATLAS_OVERLAY_TAG);
  if (options.manifest)
    element.manifest = options.manifest;
  if (options.manifestUrl)
    element.setAttribute("manifest-url", options.manifestUrl);
  (options.parent ?? document.body).append(element);
  return element;
}
function badge(text) {
  const element = document.createElement("span");
  element.className = "badge";
  element.textContent = text;
  return element;
}
function cssEscape(value) {
  return globalThis.CSS?.escape ? globalThis.CSS.escape(value) : value.replace(/["\\]/g, "\\$&");
}
export {
  METRIC_ATLAS_OVERLAY_TAG,
  MetricAtlasOverlayElement,
  defineMetricAtlasOverlay,
  mountMetricAtlasOverlay
};
