import { analyzeSource } from "../dist/index.js";

const nativeCases = Array.from({ length: 20 }, (_, index) => {
  if (index % 2 === 0) {
    return {
      eventKey: `ga4:acceptance_ga4_${index}`,
      source: `<button onClick={() => gtag("event", "acceptance_ga4_${index}", { slot: "${index}" })}>GA4 ${index}</button>`,
    };
  }
  return {
    eventKey: `gtm:acceptance_gtm_${index}`,
    source: `<button onClick={() => dataLayer.push({ event: "acceptance_gtm_${index}", slot: "${index}" })}>GTM ${index}</button>`,
  };
});

const unresolvedEventKey = "ga4:acceptance_bootstrap_ready";
const source = `
  gtag("event", "acceptance_bootstrap_ready", { route: "/" });
  export const AcceptanceCorpus = () => <>${nativeCases
    .map((entry) => entry.source)
    .join("\n")}</>;
  const alias = gtag;
  alias("event", "unsupported_alias_call");
  sendGAEvent({ event: "unsupported_object_form" });
  analytics.track("unsupported_wrapper_call");
`;

const result = analyzeSource(source, {
  file: "src/AcceptanceCorpus.tsx",
  buildId: "acceptance-corpus",
});
const expectedEventKeys = new Set([
  ...nativeCases.map((entry) => entry.eventKey),
  unresolvedEventKey,
]);
const actualEventKeys = result.events.map((event) => event.eventKey);
const falsePositiveCount = actualEventKeys.filter(
  (eventKey) => !expectedEventKeys.has(eventKey),
).length;
const missingCount = [...expectedEventKeys].filter(
  (eventKey) => !actualEventKeys.includes(eventKey),
).length;
const exactBindings = result.events.filter(
  (event) => event.overlaySupported && expectedEventKeys.has(event.eventKey),
).length;
const unresolvedCount = result.events.filter(
  (event) => !event.overlaySupported && expectedEventKeys.has(event.eventKey),
).length;
const providerFalsePositivePercent =
  (falsePositiveCount / expectedEventKeys.size) * 100;
const exactBindingPercent = (exactBindings / nativeCases.length) * 100;
const unresolvedPercent = (unresolvedCount / expectedEventKeys.size) * 100;
const passed =
  missingCount === 0 &&
  providerFalsePositivePercent <= 1 &&
  exactBindingPercent >= 90 &&
  unresolvedPercent <= 10;

const report = {
  supportedDirectCalls: expectedEventKeys.size,
  nativeBindingDenominator: nativeCases.length,
  detected: result.events.length,
  missingCount,
  falsePositiveCount,
  providerFalsePositivePercent,
  exactBindings,
  exactBindingPercent,
  unresolvedCount,
  unresolvedPercent: Math.round(unresolvedPercent * 100) / 100,
  warnings: result.warnings.map((warning) => warning.code),
  passed,
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!passed) process.exitCode = 1;
