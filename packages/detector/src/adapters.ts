import * as t from "@babel/types";
import type { NodePath } from "@babel/traverse";
import type {
  AnalyticsProvider,
  ProviderDetectionConfidence,
  TrackingEmitter,
} from "./model.js";

export interface DetectionCandidate {
  emitter: TrackingEmitter;
  analyticsProvider: AnalyticsProvider;
  providerDetectionConfidence: ProviderDetectionConfidence;
  eventNameNode: t.Node | null;
  parametersNode: t.ObjectExpression | null;
}

export interface DetectorAdapter {
  name: DetectorAdapterName;
  matchesSdkReference(path: NodePath<t.CallExpression>): boolean;
  detect(path: NodePath<t.CallExpression>): DetectionCandidate | null;
}

export type DetectorAdapterName =
  | "ga4"
  | "gtm"
  | "mixpanel"
  | "meta"
  | "posthog"
  | "amplitude";

export const DEFAULT_DETECTOR_ADAPTERS = ["ga4", "gtm"] as const satisfies readonly DetectorAdapterName[];

function identifierCall(path: NodePath<t.CallExpression>, name: string): boolean {
  return t.isIdentifier(path.node.callee, { name });
}

function memberCall(
  path: NodePath<t.CallExpression>,
  objectName: string,
  propertyName: string,
): boolean {
  const callee = path.node.callee;
  return (
    t.isMemberExpression(callee) &&
    !callee.computed &&
    t.isIdentifier(callee.object, { name: objectName }) &&
    t.isIdentifier(callee.property, { name: propertyName })
  );
}

function expressionArgument(node: t.Node | null | undefined): t.Node | null {
  return node && !t.isSpreadElement(node) && !t.isArgumentPlaceholder(node)
    ? node
    : null;
}

function objectArgument(node: t.Node | null | undefined): t.ObjectExpression | null {
  const expression = unwrapExpression(node);
  return t.isObjectExpression(expression) ? expression : null;
}

function unwrapExpression(node: t.Node | null | undefined): t.Node | null {
  let current = node ?? null;
  while (
    t.isTSAsExpression(current) ||
    t.isTSTypeAssertion(current) ||
    t.isTSNonNullExpression(current) ||
    t.isTSSatisfiesExpression(current) ||
    t.isTypeCastExpression(current) ||
    t.isParenthesizedExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function objectPropertyValue(
  object: t.ObjectExpression,
  propertyName: string,
): t.Node | null {
  for (const property of object.properties) {
    if (!t.isObjectProperty(property) || property.computed) continue;
    const key = property.key;
    if (
      (t.isIdentifier(key) && key.name === propertyName) ||
      (t.isStringLiteral(key) && key.value === propertyName)
    ) {
      return property.value;
    }
  }
  return null;
}

const ga4Adapter: DetectorAdapter = {
  name: "ga4",
  matchesSdkReference(path) {
    return identifierCall(path, "gtag") || identifierCall(path, "sendGAEvent");
  },
  detect(path) {
    if (!this.matchesSdkReference(path)) return null;
    const [command, eventName, parameters] = path.node.arguments;
    if (!t.isStringLiteral(command, { value: "event" })) return null;
    return {
      emitter: "ga4",
      analyticsProvider: "ga4",
      providerDetectionConfidence: "provider_exact",
      eventNameNode: expressionArgument(eventName),
      parametersNode: objectArgument(parameters),
    };
  },
};

const gtmAdapter: DetectorAdapter = {
  name: "gtm",
  matchesSdkReference(path) {
    return memberCall(path, "dataLayer", "push");
  },
  detect(path) {
    if (!this.matchesSdkReference(path)) return null;
    const payload = objectArgument(path.node.arguments[0]);
    if (!payload) return null;
    const eventNameNode = objectPropertyValue(payload, "event");
    if (!eventNameNode) return null;
    return {
      emitter: "gtm",
      analyticsProvider: "unknown",
      providerDetectionConfidence: "provider_unknown",
      eventNameNode,
      parametersNode: payload,
    };
  },
};

function memberEventAdapter(
  name: string,
  method: string,
  emitter: DetectorAdapterName,
  provider: AnalyticsProvider,
): DetectorAdapter {
  return {
    name: emitter,
    matchesSdkReference(path) {
      return memberCall(path, name, method);
    },
    detect(path) {
      if (!this.matchesSdkReference(path)) return null;
      return {
        emitter,
        analyticsProvider: provider,
        providerDetectionConfidence: "provider_exact",
        eventNameNode: expressionArgument(path.node.arguments[0]),
        parametersNode: objectArgument(path.node.arguments[1]),
      };
    },
  };
}

const metaAdapter: DetectorAdapter = {
  name: "meta",
  matchesSdkReference(path) {
    return identifierCall(path, "fbq");
  },
  detect(path) {
    if (!this.matchesSdkReference(path)) return null;
    const [command, eventName, parameters] = path.node.arguments;
    if (
      !t.isStringLiteral(command) ||
      (command.value !== "track" && command.value !== "trackCustom")
    ) {
      return null;
    }
    return {
      emitter: "meta",
      analyticsProvider: "meta",
      providerDetectionConfidence: "provider_exact",
      eventNameNode: expressionArgument(eventName),
      parametersNode: objectArgument(parameters),
    };
  },
};

export const detectorAdaptersByName: Readonly<
  Record<DetectorAdapterName, DetectorAdapter>
> = {
  ga4: ga4Adapter,
  gtm: gtmAdapter,
  mixpanel: memberEventAdapter("mixpanel", "track", "mixpanel", "mixpanel"),
  meta: metaAdapter,
  posthog: memberEventAdapter("posthog", "capture", "posthog", "posthog"),
  amplitude: memberEventAdapter("amplitude", "track", "amplitude", "amplitude"),
};

/** DEC-037: official MVP detection defaults to GA4/GTM only. */
export const defaultDetectorAdapters: readonly DetectorAdapter[] =
  detectorAdaptersFor(DEFAULT_DETECTOR_ADAPTERS);

export function detectorAdaptersFor(
  names: readonly DetectorAdapterName[],
): readonly DetectorAdapter[] {
  return [...new Set(names)].map((name) => detectorAdaptersByName[name]);
}

export function isDetectorAdapterName(value: string): value is DetectorAdapterName {
  return Object.hasOwn(detectorAdaptersByName, value);
}
