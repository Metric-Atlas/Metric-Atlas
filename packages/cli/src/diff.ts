import type {
  AnalyticsProvider,
  DetectedEvent,
  EventManifest,
  TrackingEmitter,
} from "@metric-atlas/contracts";

export interface ChangedEvent {
  eventName: string;
  fromEventKey: string;
  toEventKey: string;
  fromEmitter: TrackingEmitter;
  toEmitter: TrackingEmitter;
  fromProvider: AnalyticsProvider;
  toProvider: AnalyticsProvider;
}

export interface ParameterChange {
  eventKey: string;
  parameter: string;
}

export interface ManifestDiff {
  addedEvents: string[];
  removedEvents: string[];
  changedEvents: ChangedEvent[];
  addedParameters: ParameterChange[];
  removedParameters: ParameterChange[];
  warningCounts: {
    dynamicOrUnresolved: number;
    possibleWrapperUsage: number;
  };
}

interface LogicalEvent {
  eventKey: string;
  eventName: string;
  emitter: TrackingEmitter;
  provider: AnalyticsProvider;
  parameters: Set<string>;
}

export function diffManifests(
  base: EventManifest,
  head: EventManifest,
): ManifestDiff {
  const baseEvents = logicalEvents(base.events);
  const headEvents = logicalEvents(head.events);
  const added = new Set([...headEvents.keys()].filter((key) => !baseEvents.has(key)));
  const removed = new Set([...baseEvents.keys()].filter((key) => !headEvents.has(key)));
  const changedEvents: ChangedEvent[] = [];

  for (const removedKey of [...removed]) {
    const from = baseEvents.get(removedKey)!;
    const candidates = [...added]
      .map((key) => headEvents.get(key)!)
      .filter((event) => event.eventName === from.eventName);
    if (candidates.length !== 1) continue;
    const to = candidates[0]!;
    changedEvents.push({
      eventName: from.eventName,
      fromEventKey: from.eventKey,
      toEventKey: to.eventKey,
      fromEmitter: from.emitter,
      toEmitter: to.emitter,
      fromProvider: from.provider,
      toProvider: to.provider,
    });
    removed.delete(removedKey);
    added.delete(to.eventKey);
  }

  const addedParameters: ParameterChange[] = [];
  const removedParameters: ParameterChange[] = [];
  const comparablePairs: Array<[LogicalEvent, LogicalEvent]> = [];
  for (const [eventKey, baseEvent] of baseEvents) {
    const headEvent = headEvents.get(eventKey);
    if (headEvent) comparablePairs.push([baseEvent, headEvent]);
  }
  for (const change of changedEvents) {
    comparablePairs.push([
      baseEvents.get(change.fromEventKey)!,
      headEvents.get(change.toEventKey)!,
    ]);
  }
  for (const [baseEvent, headEvent] of comparablePairs) {
    for (const parameter of headEvent.parameters) {
      if (!baseEvent.parameters.has(parameter)) {
        addedParameters.push({ eventKey: headEvent.eventKey, parameter });
      }
    }
    for (const parameter of baseEvent.parameters) {
      if (!headEvent.parameters.has(parameter)) {
        removedParameters.push({ eventKey: baseEvent.eventKey, parameter });
      }
    }
  }

  return {
    addedEvents: [...added].sort(),
    removedEvents: [...removed].sort(),
    changedEvents: changedEvents.sort((left, right) =>
      left.eventName.localeCompare(right.eventName),
    ),
    addedParameters: sortParameterChanges(addedParameters),
    removedParameters: sortParameterChanges(removedParameters),
    warningCounts: {
      dynamicOrUnresolved: head.warnings.filter((warning) =>
        [
          "DYNAMIC_EVENT_NAME",
          "UNRESOLVED_EVENT_BINDING",
          "CUSTOM_COMPONENT_OVERLAY_UNSUPPORTED",
          "PORTAL_OVERLAY_UNSUPPORTED",
        ].includes(warning.code),
      ).length,
      possibleWrapperUsage: head.warnings.filter(
        (warning) => warning.code === "POSSIBLE_WRAPPER_USAGE",
      ).length,
    },
  };
}

export function formatMarkdownReport(diff: ManifestDiff): string {
  const lines = [
    "## Metric Atlas Analytics Change",
    "",
    `- + Added events: ${diff.addedEvents.length}`,
    `- - Removed events: ${diff.removedEvents.length}`,
    `- ~ Changed emitter/provider: ${diff.changedEvents.length}`,
    `- ! Dynamic/unresolved: ${diff.warningCounts.dynamicOrUnresolved}`,
    `- ! Possible wrapper usage: ${diff.warningCounts.possibleWrapperUsage}`,
  ];
  appendList(lines, "Added events", diff.addedEvents.map(markdownCode));
  appendList(lines, "Removed events", diff.removedEvents.map(markdownCode));
  appendList(
    lines,
    "Changed emitter/provider",
    diff.changedEvents.map(
      (event) =>
        `${markdownCode(event.eventName)}: ${event.fromEmitter}/${event.fromProvider} → ${event.toEmitter}/${event.toProvider}`,
    ),
  );

  const ga4Added = diff.addedParameters.filter((change) =>
    change.eventKey.startsWith("ga4:"),
  );
  const ga4Removed = diff.removedParameters.filter((change) =>
    change.eventKey.startsWith("ga4:"),
  );
  if (ga4Added.length || ga4Removed.length) {
    lines.push("", "### GA4 custom parameter changes", "");
    for (const change of ga4Added) {
      lines.push(`- + ${markdownCode(change.eventKey)}: ${markdownCode(change.parameter)}`);
    }
    for (const change of ga4Removed) {
      lines.push(`- - ${markdownCode(change.eventKey)}: ${markdownCode(change.parameter)}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function logicalEvents(events: readonly DetectedEvent[]): Map<string, LogicalEvent> {
  const result = new Map<string, LogicalEvent>();
  for (const event of events) {
    const current = result.get(event.eventKey);
    if (current) {
      for (const parameter of event.parameters) current.parameters.add(parameter);
      continue;
    }
    result.set(event.eventKey, {
      eventKey: event.eventKey,
      eventName: event.eventName,
      emitter: event.emitter,
      provider: event.analyticsProvider,
      parameters: new Set(event.parameters),
    });
  }
  return result;
}

function appendList(lines: string[], title: string, values: string[]): void {
  if (values.length === 0) return;
  lines.push("", `### ${title}`, "", ...values.map((value) => `- ${value}`));
}

function sortParameterChanges(changes: ParameterChange[]): ParameterChange[] {
  return changes.sort((left, right) =>
    `${left.eventKey}:${left.parameter}`.localeCompare(
      `${right.eventKey}:${right.parameter}`,
    ),
  );
}

function markdownCode(value: string): string {
  return `\`${value.replace(/[\r\n]+/g, " ").replace(/`/g, "\\`")}\``;
}
