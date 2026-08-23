// packages/vite/dist/index.js
import { existsSync } from "node:fs";
import path2 from "node:path";
import { fileURLToPath } from "node:url";

// packages/detector/dist/adapters.js
import * as t from "@babel/types";
var DEFAULT_DETECTOR_ADAPTERS = ["ga4", "gtm"];
function identifierCall(path3, name) {
  return t.isIdentifier(path3.node.callee, { name });
}
function memberCall(path3, objectName, propertyName) {
  const callee = path3.node.callee;
  return t.isMemberExpression(callee) && !callee.computed && t.isIdentifier(callee.object, { name: objectName }) && t.isIdentifier(callee.property, { name: propertyName });
}
function nestedMemberCall(path3, rootNames, objectName, propertyName) {
  const callee = path3.node.callee;
  if (!t.isMemberExpression(callee) || callee.computed || !t.isIdentifier(callee.property, { name: propertyName }) || !t.isMemberExpression(callee.object) || callee.object.computed || !t.isIdentifier(callee.object.property, { name: objectName }) || !t.isIdentifier(callee.object.object)) {
    return false;
  }
  return rootNames.includes(callee.object.object.name);
}
function expressionArgument(node) {
  return node && !t.isSpreadElement(node) && !t.isArgumentPlaceholder(node) ? node : null;
}
function objectArgument(node) {
  const expression = unwrapExpression(node);
  return t.isObjectExpression(expression) ? expression : null;
}
function unwrapExpression(node) {
  let current = node ?? null;
  while (t.isTSAsExpression(current) || t.isTSTypeAssertion(current) || t.isTSNonNullExpression(current) || t.isTSSatisfiesExpression(current) || t.isTypeCastExpression(current) || t.isParenthesizedExpression(current)) {
    current = current.expression;
  }
  return current;
}
function objectPropertyValue(object, propertyName) {
  for (const property of object.properties) {
    if (!t.isObjectProperty(property) || property.computed)
      continue;
    const key = property.key;
    if (t.isIdentifier(key) && key.name === propertyName || t.isStringLiteral(key) && key.value === propertyName) {
      return property.value;
    }
  }
  return null;
}
var ga4Adapter = {
  name: "ga4",
  matchesSdkReference(path3) {
    return identifierCall(path3, "gtag") || identifierCall(path3, "sendGAEvent");
  },
  detect(path3) {
    if (!this.matchesSdkReference(path3))
      return null;
    const [command, eventName, parameters] = path3.node.arguments;
    if (!t.isStringLiteral(command, { value: "event" }))
      return null;
    return {
      emitter: "ga4",
      analyticsProvider: "ga4",
      providerDetectionConfidence: "provider_exact",
      eventNameNode: expressionArgument(eventName),
      parametersNode: objectArgument(parameters)
    };
  }
};
var gtmAdapter = {
  name: "gtm",
  matchesSdkReference(path3) {
    return memberCall(path3, "dataLayer", "push") || nestedMemberCall(path3, ["window", "globalThis"], "dataLayer", "push");
  },
  detect(path3) {
    if (!this.matchesSdkReference(path3))
      return null;
    const payload = objectArgument(path3.node.arguments[0]);
    if (!payload)
      return null;
    const eventNameNode = objectPropertyValue(payload, "event");
    if (!eventNameNode)
      return null;
    return {
      emitter: "gtm",
      analyticsProvider: "unknown",
      providerDetectionConfidence: "provider_unknown",
      eventNameNode,
      parametersNode: payload
    };
  }
};
function memberEventAdapter(name, method, emitter, provider) {
  return {
    name: emitter,
    matchesSdkReference(path3) {
      return memberCall(path3, name, method);
    },
    detect(path3) {
      if (!this.matchesSdkReference(path3))
        return null;
      return {
        emitter,
        analyticsProvider: provider,
        providerDetectionConfidence: "provider_exact",
        eventNameNode: expressionArgument(path3.node.arguments[0]),
        parametersNode: objectArgument(path3.node.arguments[1])
      };
    }
  };
}
var metaAdapter = {
  name: "meta",
  matchesSdkReference(path3) {
    return identifierCall(path3, "fbq");
  },
  detect(path3) {
    if (!this.matchesSdkReference(path3))
      return null;
    const [command, eventName, parameters] = path3.node.arguments;
    if (!t.isStringLiteral(command) || command.value !== "track" && command.value !== "trackCustom") {
      return null;
    }
    return {
      emitter: "meta",
      analyticsProvider: "meta",
      providerDetectionConfidence: "provider_exact",
      eventNameNode: expressionArgument(eventName),
      parametersNode: objectArgument(parameters)
    };
  }
};
var detectorAdaptersByName = {
  ga4: ga4Adapter,
  gtm: gtmAdapter,
  mixpanel: memberEventAdapter("mixpanel", "track", "mixpanel", "mixpanel"),
  meta: metaAdapter,
  posthog: memberEventAdapter("posthog", "capture", "posthog", "posthog"),
  amplitude: memberEventAdapter("amplitude", "track", "amplitude", "amplitude")
};
var defaultDetectorAdapters = detectorAdaptersFor(DEFAULT_DETECTOR_ADAPTERS);
function detectorAdaptersFor(names) {
  return [...new Set(names)].map((name) => detectorAdaptersByName[name]);
}

// packages/detector/dist/analyze.js
import generate from "@babel/generator";
import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import * as t2 from "@babel/types";

// packages/detector/dist/manifest.js
import { createHash } from "node:crypto";

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

// packages/detector/dist/manifest.js
var MANIFEST_VERSION = "0.1";
function shortHash(input) {
  return createHash("sha256").update(input).digest("hex").slice(0, 12);
}
function createBuildId(seed) {
  return `build_${shortHash(seed)}`;
}
function createManifest(parts, options) {
  const manifest = {
    version: options.version ?? MANIFEST_VERSION,
    buildId: options.buildId,
    generatedAt: options.generatedAt ?? (/* @__PURE__ */ new Date()).toISOString(),
    events: parts.events,
    bindings: parts.bindings,
    warnings: parts.warnings,
    summaries: summarize(parts)
  };
  if (options.scanStats)
    manifest.scanStats = options.scanStats;
  return EventManifest.parse(manifest);
}
function summarize(parts) {
  const emitters = /* @__PURE__ */ new Map();
  const providers = /* @__PURE__ */ new Map();
  for (const event of parts.events) {
    emitters.set(event.emitter, (emitters.get(event.emitter) ?? 0) + 1);
    providers.set(event.analyticsProvider, (providers.get(event.analyticsProvider) ?? 0) + 1);
  }
  return {
    emitters: [...emitters].sort(([left], [right]) => left.localeCompare(right)).map(([name, eventCount]) => ({ name, eventCount })),
    analyticsProviders: [...providers].sort(([left], [right]) => left.localeCompare(right)).map(([name, eventCount]) => ({ name, eventCount }))
  };
}

// packages/detector/dist/analyze.js
var ANALYTICS_IMPORT_PATTERN = /(?:analytics|gtag|google-analytics|react-ga4|third-parties\/google|gtm|mixpanel|posthog|amplitude|facebook)/i;
function analyzeSource(source, options) {
  let ast;
  try {
    ast = parse(source, {
      sourceType: "unambiguous",
      sourceFilename: options.file,
      plugins: parserPlugins(options.file)
    });
  } catch (error) {
    return {
      events: [],
      bindings: [],
      warnings: [
        {
          code: "PARSE_ERROR",
          file: options.file,
          message: error instanceof Error ? error.message : String(error)
        }
      ],
      transform: { code: source, map: null, changed: false }
    };
  }
  const adapters = options.adapters ?? defaultDetectorAdapters;
  const warnings = [];
  const warningKeys = /* @__PURE__ */ new Set();
  const handlerTargets = /* @__PURE__ */ new Map();
  const targetCache = /* @__PURE__ */ new Map();
  let sdkEvidence = false;
  const addWarning = (warning) => {
    const key = [
      warning.code,
      warning.file ?? "",
      warning.line ?? "",
      warning.relatedImplementationKey ?? "",
      warning.message ?? ""
    ].join(":");
    if (!warningKeys.has(key)) {
      warningKeys.add(key);
      warnings.push(warning);
    }
  };
  traverse(ast, {
    ImportDeclaration(path3) {
      if (ANALYTICS_IMPORT_PATTERN.test(path3.node.source.value)) {
        sdkEvidence = true;
      }
    },
    JSXAttribute(path3) {
      if (!isJsxHandlerAttribute(path3.node))
        return;
      const expression = path3.node.value;
      if (!t2.isJSXExpressionContainer(expression))
        return;
      const target = targetForAttribute(path3, targetCache);
      if (!target)
        return;
      const handlerNode = resolveHandlerFunction(path3, expression.expression);
      if (!handlerNode)
        return;
      const targets = handlerTargets.get(handlerNode) ?? [];
      targets.push(target);
      handlerTargets.set(handlerNode, targets);
    }
  });
  const events = [];
  const targetEvents = /* @__PURE__ */ new Map();
  traverse(ast, {
    CallExpression(path3) {
      const matchingAdapter = adapters.find((adapter) => adapter.matchesSdkReference(path3));
      if (!matchingAdapter)
        return;
      sdkEvidence = true;
      const candidate = matchingAdapter.detect(path3);
      if (!candidate)
        return;
      const eventName = staticString(candidate.eventNameNode);
      const callLocation = sourceLocation(options.file, path3.node);
      if (eventName === null) {
        addWarning({
          code: "DYNAMIC_EVENT_NAME",
          file: options.file,
          line: callLocation.line,
          message: `${matchingAdapter.name} eventName is not a static string and was not added to events.`
        });
        return;
      }
      const eventKey = createEventKey(candidate, eventName);
      const implementationKey = `impl_${shortHash([
        eventKey,
        options.file,
        enclosingSymbol(path3),
        callLocation.line,
        callLocation.column ?? 1
      ].join(":"))}`;
      const parameterResult = extractParameters(candidate.parametersNode, candidate.emitter === "gtm" ? /* @__PURE__ */ new Set(["event"]) : /* @__PURE__ */ new Set());
      if (parameterResult.dynamic) {
        addWarning({
          code: "DYNAMIC_PARAMETER_KEY",
          file: options.file,
          line: callLocation.line,
          message: "Only statically named parameter keys are included in the manifest.",
          relatedImplementationKey: implementationKey
        });
      }
      const eventIndex = events.push({
        eventKey,
        implementationKey,
        eventName,
        emitter: candidate.emitter,
        analyticsProvider: candidate.analyticsProvider,
        providerDetectionConfidence: candidate.providerDetectionConfidence,
        parameters: parameterResult.parameters,
        source: callLocation,
        overlaySupported: false
      }) - 1;
      const targets = targetsForCall(path3, handlerTargets, targetCache);
      let bound = false;
      for (const target of targets) {
        if (!target.native) {
          addWarning({
            code: "CUSTOM_COMPONENT_OVERLAY_UNSUPPORTED",
            file: options.file,
            line: locationLine(target.openingPath.node),
            message: `<${target.elementType}> is not a native JSX element.`,
            relatedImplementationKey: implementationKey
          });
          continue;
        }
        if (target.portal) {
          addWarning({
            code: "PORTAL_OVERLAY_UNSUPPORTED",
            file: options.file,
            line: locationLine(target.openingPath.node),
            message: "Portal targets are outside MVP overlay injection coverage.",
            relatedImplementationKey: implementationKey
          });
          continue;
        }
        if (target.attributeConflict) {
          addWarning({
            code: "ATLAS_ATTRIBUTE_CONFLICT",
            file: options.file,
            line: locationLine(target.openingPath.node),
            message: "Existing data-atlas-id was preserved; Metric Atlas did not bind this element.",
            relatedImplementationKey: implementationKey
          });
          continue;
        }
        const record = targetEvents.get(target.openingPath.node) ?? {
          target,
          eventIndexes: /* @__PURE__ */ new Set()
        };
        record.eventIndexes.add(eventIndex);
        targetEvents.set(target.openingPath.node, record);
        events[eventIndex].overlaySupported = true;
        bound = true;
      }
      if (!bound && targets.length === 0) {
        addWarning({
          code: "UNRESOLVED_EVENT_BINDING",
          file: options.file,
          line: callLocation.line,
          message: "Direct event call was not connected to a supported same-file JSX handler.",
          relatedImplementationKey: implementationKey
        });
      }
    }
  });
  if (sdkEvidence && events.length === 0) {
    addWarning({
      code: "POSSIBLE_WRAPPER_USAGE",
      file: options.file,
      message: "Analytics SDK/import detected but supported direct event call count is 0. A wrapper may be in use."
    });
  }
  const bindings = [];
  for (const { target, eventIndexes } of targetEvents.values()) {
    const line = locationLine(target.openingPath.node);
    const column = locationColumn(target.openingPath.node);
    const atlasDomId = `atlas_${shortHash([options.buildId, options.file, target.elementType, line, column].join(":"))}`;
    target.openingPath.node.attributes.unshift(t2.jsxAttribute(t2.jsxIdentifier("data-atlas-id"), t2.stringLiteral(atlasDomId)));
    const boundEvents = [...eventIndexes].map((index) => events[index]);
    bindings.push({
      atlasDomId,
      eventKeys: unique(boundEvents.map((event) => event.eventKey)),
      implementationKeys: unique(boundEvents.map((event) => event.implementationKey)),
      element: {
        type: target.elementType,
        file: options.file,
        line,
        column
      },
      bindingConfidence: "binding_exact"
    });
  }
  if (bindings.length === 0) {
    return {
      events,
      bindings,
      warnings,
      transform: { code: source, map: null, changed: false }
    };
  }
  const generated = generate(ast, {
    sourceMaps: true,
    sourceFileName: options.file,
    retainLines: true,
    comments: true
  }, source);
  return {
    events,
    bindings,
    warnings,
    transform: {
      code: generated.code,
      map: generated.map,
      changed: true
    }
  };
}
function parserPlugins(file) {
  const plugins = ["jsx"];
  if (/\.[cm]?tsx?$/i.test(file))
    plugins.push("typescript");
  return plugins;
}
function isJsxHandlerAttribute(node) {
  return t2.isJSXIdentifier(node.name) && /^on[A-Z]/.test(node.name.name);
}
function targetForAttribute(path3, cache) {
  const parent = path3.parentPath;
  if (!parent?.isJSXOpeningElement())
    return null;
  const cached = cache.get(parent.node);
  if (cached)
    return cached;
  const elementType = jsxElementName(parent.node.name);
  const target = {
    openingPath: parent,
    elementType,
    native: /^[a-z]/.test(elementType),
    portal: isInsidePortal(parent),
    attributeConflict: parent.node.attributes.some((attribute) => t2.isJSXAttribute(attribute) && t2.isJSXIdentifier(attribute.name, { name: "data-atlas-id" }))
  };
  cache.set(parent.node, target);
  return target;
}
function resolveHandlerFunction(path3, expression) {
  if (t2.isFunctionExpression(expression) || t2.isArrowFunctionExpression(expression)) {
    return expression;
  }
  if (!t2.isIdentifier(expression))
    return null;
  return functionNodeForBinding(path3.scope.getBinding(expression.name));
}
function functionNodeForBinding(binding) {
  if (!binding)
    return null;
  if (binding.path.isFunctionDeclaration() || binding.path.isFunctionExpression() || binding.path.isArrowFunctionExpression()) {
    return binding.path.node;
  }
  if (binding.path.isVariableDeclarator()) {
    const init = binding.path.node.init;
    if (t2.isFunctionExpression(init) || t2.isArrowFunctionExpression(init))
      return init;
  }
  return null;
}
function targetsForCall(path3, handlerTargets, targetCache) {
  const jsxAttribute2 = path3.findParent((parent) => parent.isJSXAttribute());
  if (jsxAttribute2?.isJSXAttribute()) {
    const target = targetForAttribute(jsxAttribute2, targetCache);
    return target ? [target] : [];
  }
  const functionParent = path3.getFunctionParent();
  return functionParent ? handlerTargets.get(functionParent.node) ?? [] : [];
}
function staticString(node) {
  while (t2.isTSAsExpression(node) || t2.isTSTypeAssertion(node) || t2.isTSNonNullExpression(node) || t2.isTSSatisfiesExpression(node) || t2.isTypeCastExpression(node) || t2.isParenthesizedExpression(node)) {
    node = node.expression;
  }
  if (t2.isStringLiteral(node))
    return node.value;
  if (t2.isTemplateLiteral(node) && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? node.quasis[0]?.value.raw ?? "";
  }
  return null;
}
function extractParameters(node, excluded) {
  if (!node)
    return { parameters: [], dynamic: false };
  const parameters = [];
  let dynamic = false;
  for (const property of node.properties) {
    if (t2.isSpreadElement(property) || t2.isObjectMethod(property) || property.computed) {
      dynamic = true;
      continue;
    }
    if (!t2.isObjectProperty(property))
      continue;
    const key = property.key;
    const value = t2.isIdentifier(key) ? key.name : t2.isStringLiteral(key) || t2.isNumericLiteral(key) ? String(key.value) : null;
    if (value === null) {
      dynamic = true;
    } else if (!excluded.has(value)) {
      parameters.push(value);
    }
  }
  return { parameters: unique(parameters).sort(), dynamic };
}
function createEventKey(candidate, eventName) {
  const namespace = candidate.analyticsProvider === "unknown" ? candidate.emitter : candidate.analyticsProvider;
  return `${namespace}:${eventName}`;
}
function sourceLocation(file, node) {
  return {
    file,
    line: locationLine(node),
    column: locationColumn(node)
  };
}
function locationLine(node) {
  return node.loc?.start.line ?? 1;
}
function locationColumn(node) {
  return (node.loc?.start.column ?? 0) + 1;
}
function enclosingSymbol(path3) {
  const functionPath = path3.getFunctionParent();
  if (!functionPath)
    return "module";
  const node = functionPath.node;
  if (t2.isFunctionDeclaration(node) || t2.isFunctionExpression(node)) {
    if (node.id)
      return node.id.name;
  }
  const parent = functionPath.parentPath;
  if (parent?.isVariableDeclarator() && t2.isIdentifier(parent.node.id)) {
    return parent.node.id.name;
  }
  if ((t2.isObjectMethod(node) || t2.isClassMethod(node)) && t2.isIdentifier(node.key)) {
    return node.key.name;
  }
  return `anonymous@${locationLine(node)}`;
}
function jsxElementName(name) {
  if (t2.isJSXIdentifier(name))
    return name.name;
  if (t2.isJSXMemberExpression(name)) {
    return `${jsxMemberObjectName(name.object)}.${name.property.name}`;
  }
  return `${name.namespace.name}:${name.name.name}`;
}
function jsxMemberObjectName(node) {
  return t2.isJSXIdentifier(node) ? node.name : `${jsxMemberObjectName(node.object)}.${node.property.name}`;
}
function isInsidePortal(path3) {
  return Boolean(path3.findParent((parent) => {
    if (!parent.isCallExpression())
      return false;
    const callee = parent.node.callee;
    return t2.isIdentifier(callee, { name: "createPortal" }) || t2.isMemberExpression(callee) && !callee.computed && t2.isIdentifier(callee.property, { name: "createPortal" });
  }));
}
function unique(items) {
  return [...new Set(items)];
}

// packages/detector/dist/project.js
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import fg from "fast-glob";
import { minimatch } from "minimatch";
var execFileAsync = promisify(execFile);
var DEFAULT_INCLUDE = ["src/**/*.{js,jsx,ts,tsx,mjs,mjsx,mts,mtsx,cjs,cjsx,cts,ctsx}"];
var DEFAULT_EXCLUDE = [
  "**/node_modules/**",
  "**/dist/**",
  "**/*.test.*",
  "**/*.spec.*",
  "**/*.stories.*"
];
function toPosix(file) {
  return file.split(path.sep).join("/");
}

// packages/vite/dist/index.js
import { minimatch as minimatch2 } from "minimatch";
import { normalizePath } from "vite";
var VIRTUAL_OVERLAY_ID = "virtual:metric-atlas-overlay-entry";
var RESOLVED_VIRTUAL_OVERLAY_ID = `\0${VIRTUAL_OVERLAY_ID}`;
var DEFAULT_MANIFEST_ENDPOINT = "/__metric-atlas/api/manifest";
function metricAtlas(options = {}) {
  const enabled = options.enabled ?? true;
  const include = options.include ?? DEFAULT_INCLUDE;
  const exclude = options.exclude ?? DEFAULT_EXCLUDE;
  const manifestFile = options.manifestFile ?? ".metric-atlas/manifest.json";
  const manifestEndpoint = options.manifestEndpoint ?? DEFAULT_MANIFEST_ENDPOINT;
  const overlayEnabled = options.overlay?.enabled ?? true;
  const adapters = options.detectors ? detectorAdaptersFor(options.detectors) : void 0;
  const overlayModuleId = normalizePath(resolveOverlayModulePath());
  let config = null;
  let generatedAt = (/* @__PURE__ */ new Date()).toISOString();
  let buildId = options.buildId ?? createBuildId(generatedAt);
  let durationMs = 0;
  const analyses = /* @__PURE__ */ new Map();
  const transformCache = /* @__PURE__ */ new Map();
  const removeFile = (id) => {
    if (!config)
      return;
    const file = sourceFile(id);
    if (!file)
      return;
    const relativeFile = toPosix(path2.relative(config.root, file));
    analyses.delete(relativeFile);
    transformCache.delete(relativeFile);
  };
  const currentManifest = () => {
    const values = [...analyses.values()];
    const events = values.flatMap((analysis) => analysis.events);
    return createManifest({
      events,
      bindings: values.flatMap((analysis) => analysis.bindings),
      warnings: values.flatMap((analysis) => analysis.warnings)
    }, {
      buildId,
      generatedAt,
      scanStats: {
        filesScanned: values.length,
        durationMs: Math.round(durationMs * 100) / 100,
        eventsDetected: events.length
      }
    });
  };
  const overlayManifestUrl = () => {
    if (!config || config.command === "serve") {
      return manifestEndpoint;
    }
    return `${config.base}${manifestFile.replace(/^\/+/, "")}`;
  };
  const plugin = {
    name: "metric-atlas",
    enforce: "pre",
    api: { getManifest: currentManifest },
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    buildStart() {
      analyses.clear();
      transformCache.clear();
      durationMs = 0;
      generatedAt = (/* @__PURE__ */ new Date()).toISOString();
      buildId = options.buildId ?? createBuildId(`${config?.root ?? process.cwd()}:${generatedAt}`);
    },
    resolveId(id) {
      if (id === VIRTUAL_OVERLAY_ID)
        return RESOLVED_VIRTUAL_OVERLAY_ID;
      return null;
    },
    load(id) {
      if (id !== RESOLVED_VIRTUAL_OVERLAY_ID)
        return null;
      return [
        `import { mountMetricAtlasOverlay } from ${JSON.stringify(overlayModuleId)};`,
        "const mount = () => mountMetricAtlasOverlay({",
        `  manifestUrl: ${JSON.stringify(overlayManifestUrl())}`,
        "});",
        'if (document.readyState !== "complete") {',
        '  window.addEventListener("load", mount, { once: true });',
        "} else {",
        "  mount();",
        "}"
      ].join("\n");
    },
    transform(source, id, transformOptions) {
      if (!enabled || transformOptions?.ssr || !config)
        return null;
      const file = sourceFile(id);
      if (!file)
        return null;
      const relativeFile = toPosix(path2.relative(config.root, file));
      if (!isIncluded(relativeFile, include, exclude))
        return null;
      const cached = transformCache.get(relativeFile);
      let analysis;
      if (cached?.buildId === buildId && cached.source === source) {
        analysis = cached.analysis;
      } else {
        const startedAt = performance.now();
        analysis = analyzeSource(source, {
          file: relativeFile,
          buildId,
          ...adapters ? { adapters } : {}
        });
        durationMs += performance.now() - startedAt;
        transformCache.set(relativeFile, { buildId, source, analysis });
      }
      analyses.set(relativeFile, analysis);
      if (!analysis.transform.changed)
        return null;
      return {
        code: analysis.transform.code,
        map: analysis.transform.map ? JSON.stringify(analysis.transform.map) : null
      };
    },
    watchChange(id, change) {
      if (change.event === "delete")
        removeFile(id);
    },
    transformIndexHtml: {
      order: "pre",
      handler() {
        if (!enabled || !overlayEnabled)
          return [];
        return [
          {
            tag: "script",
            attrs: { type: "module" },
            children: `import ${JSON.stringify(VIRTUAL_OVERLAY_ID)};`,
            injectTo: "body"
          }
        ];
      }
    },
    configureServer(server) {
      if (!enabled)
        return;
      const onUnlink = (file) => removeFile(file);
      server.watcher.on("unlink", onUnlink);
      server.httpServer?.once("close", () => {
        server.watcher.off("unlink", onUnlink);
      });
      server.middlewares.use((request, response, next) => {
        const requestPath = request.url?.split("?", 1)[0];
        if (requestPath !== manifestEndpoint) {
          next();
          return;
        }
        response.statusCode = 200;
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.setHeader("Cache-Control", "no-store");
        response.end(JSON.stringify(currentManifest()));
      });
    },
    generateBundle() {
      if (!enabled)
        return;
      const manifest = currentManifest();
      this.emitFile({
        type: "asset",
        fileName: manifestFile,
        source: `${JSON.stringify(manifest, null, 2)}
`
      });
      config?.logger.info(`[metric-atlas] scanned ${manifest.scanStats?.filesScanned ?? 0} files in ${manifest.scanStats?.durationMs ?? 0}ms; detected ${manifest.events.length} events`);
    }
  };
  return plugin;
}
function resolveOverlayModulePath() {
  const vendored = fileURLToPath(new URL("./vendor/overlay.js", import.meta.url));
  if (existsSync(vendored))
    return vendored;
  return fileURLToPath(import.meta.resolve("@metric-atlas/overlay"));
}
function sourceFile(id) {
  if (id.startsWith("\0") || id.includes("node_modules"))
    return null;
  const file = id.split("?", 1)[0];
  return file ? path2.resolve(file) : null;
}
function isIncluded(relativeFile, include, exclude) {
  if (relativeFile.startsWith("../") || path2.isAbsolute(relativeFile))
    return false;
  return include.some((pattern) => minimatch2(relativeFile, pattern, { dot: false })) && !exclude.some((pattern) => minimatch2(relativeFile, pattern, { dot: true }));
}
export {
  VIRTUAL_OVERLAY_ID,
  metricAtlas as default
};
//# sourceMappingURL=index.js.map
