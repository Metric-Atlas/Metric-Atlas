import type { GtmRoute, Manifest } from "./types";

interface GtmParameter {
  key?: string;
  value?: string;
}

interface GtmFilter {
  parameter?: GtmParameter[];
}

interface GtmTrigger {
  triggerId?: string;
  name?: string;
  type?: string;
  customEventFilter?: GtmFilter[];
}

interface GtmTag {
  name?: string;
  type?: string;
  parameter?: GtmParameter[];
  firingTriggerId?: string[];
}

interface GtmContainerExport {
  containerVersion?: {
    tag?: GtmTag[];
    trigger?: GtmTrigger[];
  };
}

export function resolveGtmRoutes(
  manifest: Manifest,
  containerExport: unknown,
): Map<string, GtmRoute> {
  const exportValue = containerExport as GtmContainerExport;
  const triggers = exportValue.containerVersion?.trigger ?? [];
  const tags = exportValue.containerVersion?.tag ?? [];
  const eventByTriggerId = new Map<string, { eventName: string; triggerName: string }>();

  for (const trigger of triggers) {
    if (trigger.type !== "customEvent" || !trigger.triggerId) continue;
    const eventName = customEventName(trigger);
    if (!eventName) continue;
    eventByTriggerId.set(trigger.triggerId, {
      eventName,
      triggerName: trigger.name ?? trigger.triggerId,
    });
  }

  const routes = new Map<string, GtmRoute>();
  for (const tag of tags) {
    const destinationProvider = tag.type === "gaawe" ? "ga4" : "unknown";
    for (const triggerId of tag.firingTriggerId ?? []) {
      const trigger = eventByTriggerId.get(triggerId);
      if (!trigger) continue;
      const event = manifest.events.find(
        (candidate) =>
          candidate.emitter === "gtm" &&
          candidate.eventName === trigger.eventName,
      );
      if (!event) continue;
      const measurementId = parameterValue(tag, "measurementId");
      routes.set(event.eventKey, {
        eventKey: event.eventKey,
        gtmEventName: trigger.eventName,
        triggerName: trigger.triggerName,
        tagName: tag.name ?? tag.type ?? "Unnamed GTM tag",
        destinationProvider,
        destinationEventName: parameterValue(tag, "eventName") ?? trigger.eventName,
        ...(measurementId ? { measurementId } : {}),
        confidence: destinationProvider === "ga4" ? "exact" : "unresolved",
      });
    }
  }

  return routes;
}

function customEventName(trigger: GtmTrigger): string | null {
  for (const filter of trigger.customEventFilter ?? []) {
    const parameters = filter.parameter ?? [];
    const eventVariable = parameters.some(
      (parameter) => parameter.key === "arg0" && parameter.value === "{{_event}}",
    );
    const eventName = parameters.find((parameter) => parameter.key === "arg1")?.value;
    if (eventVariable && eventName) return eventName;
  }
  return null;
}

function parameterValue(tag: GtmTag, key: string): string | undefined {
  return tag.parameter?.find((parameter) => parameter.key === key)?.value;
}
