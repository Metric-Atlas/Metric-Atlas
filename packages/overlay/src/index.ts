import {
  EventManifest as EventManifestSchema,
  DetectedEvent,
  ElementBinding,
  type EventManifest,
} from "@metric-atlas/contracts";

export const METRIC_ATLAS_OVERLAY_TAG = "metric-atlas-overlay";

export interface DomCoverage {
  injectCandidateCount: number;
  domMatchedCount: number;
  domMissingCount: number;
  bindingCoverage: number;
}

export interface MountOverlayOptions {
  manifest?: EventManifest;
  manifestUrl?: string;
  parent?: HTMLElement;
}

const template = document.createElement("template");
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

export class MetricAtlasOverlayElement extends HTMLElement {
  static observedAttributes = ["manifest-url"];

  readonly #root: ShadowRoot;
  #manifest: EventManifest | null = null;
  #bindingByDomId = new Map<string, ElementBinding>();
  #eventsByKey = new Map<string, DetectedEvent[]>();
  #enabled = false;
  #activeTarget: HTMLElement | null = null;
  #previousOutline = "";
  #previousOutlineOffset = "";

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open" });
    this.#root.append(template.content.cloneNode(true));
  }

  connectedCallback(): void {
    this.#launcher.addEventListener("click", this.#toggle);
    document.addEventListener("pointerover", this.#onPointerOver, true);
    document.addEventListener("pointerout", this.#onPointerOut, true);
    if (this.hasAttribute("manifest-url") && !this.#manifest) {
      void this.loadManifest(this.getAttribute("manifest-url")!);
    }
  }

  disconnectedCallback(): void {
    this.#launcher.removeEventListener("click", this.#toggle);
    document.removeEventListener("pointerover", this.#onPointerOver, true);
    document.removeEventListener("pointerout", this.#onPointerOut, true);
    this.#clearHighlight();
  }

  attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null,
  ): void {
    if (name === "manifest-url" && newValue && oldValue !== newValue && this.isConnected) {
      void this.loadManifest(newValue);
    }
  }

  get manifest(): EventManifest | null {
    return this.#manifest;
  }

  set manifest(value: EventManifest | null) {
    if (value) this.setManifest(value);
    else this.#resetManifest();
  }

  async loadManifest(url: string): Promise<void> {
    this.#status.textContent = "Loading manifest…";
    try {
      const response = await fetch(url, { credentials: "same-origin" });
      if (!response.ok) throw new Error(`Manifest request failed (${response.status})`);
      const value: unknown = await response.json();
      const parsed = EventManifestSchema.safeParse(value);
      if (!parsed.success) throw new Error("Manifest response has an invalid shape");
      this.setManifest(parsed.data);
    } catch (error) {
      this.#status.textContent = error instanceof Error ? error.message : "Manifest load failed";
      this.dispatchEvent(
        new CustomEvent("metric-atlas:error", {
          detail: error,
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  setManifest(manifest: EventManifest): DomCoverage {
    this.#manifest = manifest;
    this.#bindingByDomId = new Map(
      manifest.bindings.map((binding) => [binding.atlasDomId, binding]),
    );
    this.#eventsByKey.clear();
    for (const event of manifest.events) {
      const group = this.#eventsByKey.get(event.eventKey) ?? [];
      group.push(event);
      this.#eventsByKey.set(event.eventKey, group);
    }
    const coverage = this.measureCoverage();
    this.#status.textContent = `${coverage.domMatchedCount}/${coverage.injectCandidateCount} DOM matched`;
    this.dispatchEvent(
      new CustomEvent<DomCoverage>("metric-atlas:coverage", {
        detail: coverage,
        bubbles: true,
        composed: true,
      }),
    );
    return coverage;
  }

  measureCoverage(): DomCoverage {
    const ids = [...this.#bindingByDomId.keys()];
    const domMatchedCount = ids.filter((id) =>
      document.querySelector(`[data-atlas-id="${cssEscape(id)}"]`),
    ).length;
    const injectCandidateCount = ids.length;
    const domMissingCount = injectCandidateCount - domMatchedCount;
    return {
      injectCandidateCount,
      domMatchedCount,
      domMissingCount,
      bindingCoverage:
        injectCandidateCount === 0 ? 1 : domMatchedCount / injectCandidateCount,
    };
  }

  get #launcher(): HTMLButtonElement {
    return this.#root.querySelector<HTMLButtonElement>("#launcher")!;
  }

  get #panel(): HTMLElement {
    return this.#root.querySelector<HTMLElement>("#panel")!;
  }

  get #status(): HTMLElement {
    return this.#root.querySelector<HTMLElement>("#status")!;
  }

  get #details(): HTMLElement {
    return this.#root.querySelector<HTMLElement>("#details")!;
  }

  readonly #toggle = (): void => {
    this.#enabled = !this.#enabled;
    this.#panel.hidden = !this.#enabled;
    this.#launcher.setAttribute("aria-expanded", String(this.#enabled));
    if (!this.#enabled) this.#clearHighlight();
  };

  readonly #onPointerOver = (event: PointerEvent): void => {
    if (!this.#enabled || !this.#manifest) return;
    const target = event
      .composedPath()
      .find((candidate): candidate is HTMLElement => candidate instanceof HTMLElement)
      ?.closest<HTMLElement>("[data-atlas-id]");
    if (!target || target === this.#activeTarget) return;
    const atlasDomId = target.dataset.atlasId;
    if (!atlasDomId) return;
    const binding = this.#bindingByDomId.get(atlasDomId);
    if (!binding) return;
    this.#highlight(target);
    this.#renderBinding(binding);
  };

  readonly #onPointerOut = (event: PointerEvent): void => {
    if (!this.#activeTarget) return;
    const next = event.relatedTarget;
    if (next instanceof Node && this.#activeTarget.contains(next)) return;
    this.#clearHighlight();
  };

  #highlight(target: HTMLElement): void {
    this.#clearHighlight();
    this.#activeTarget = target;
    this.#previousOutline = target.style.outline;
    this.#previousOutlineOffset = target.style.outlineOffset;
    target.style.outline = "3px solid #2563eb";
    target.style.outlineOffset = "2px";
  }

  #clearHighlight(): void {
    if (!this.#activeTarget) return;
    this.#activeTarget.style.outline = this.#previousOutline;
    this.#activeTarget.style.outlineOffset = this.#previousOutlineOffset;
    this.#activeTarget = null;
  }

  #renderBinding(binding: ElementBinding): void {
    const fragment = document.createDocumentFragment();
    const candidates = binding.eventKeys.flatMap(
      (eventKey) => this.#eventsByKey.get(eventKey) ?? [],
    );
    const implementationKeys = new Set(binding.implementationKeys);
    const events = candidates.filter((event) =>
      implementationKeys.has(event.implementationKey),
    );

    for (const event of events) {
      const article = document.createElement("article");
      article.className = "event";
      const name = document.createElement("div");
      name.className = "name";
      name.textContent = event.eventName;
      const badges = document.createElement("div");
      badges.className = "badges";
      badges.append(
        badge(`Emitter: ${event.emitter}`),
        badge(`Provider: ${event.analyticsProvider}`),
      );
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
    this.#details.replaceChildren(fragment);
  }

  #resetManifest(): void {
    this.#manifest = null;
    this.#bindingByDomId.clear();
    this.#eventsByKey.clear();
    this.#status.textContent = "Manifest not loaded";
  }
}

export function defineMetricAtlasOverlay(): void {
  if (!customElements.get(METRIC_ATLAS_OVERLAY_TAG)) {
    customElements.define(METRIC_ATLAS_OVERLAY_TAG, MetricAtlasOverlayElement);
  }
}

export function mountMetricAtlasOverlay(
  options: MountOverlayOptions = {},
): MetricAtlasOverlayElement {
  defineMetricAtlasOverlay();
  const existing = document.querySelector<MetricAtlasOverlayElement>(
    METRIC_ATLAS_OVERLAY_TAG,
  );
  if (existing) {
    if (options.manifest) existing.setManifest(options.manifest);
    if (options.manifestUrl) existing.setAttribute("manifest-url", options.manifestUrl);
    return existing;
  }
  const element = document.createElement(
    METRIC_ATLAS_OVERLAY_TAG,
  ) as MetricAtlasOverlayElement;
  if (options.manifest) element.manifest = options.manifest;
  if (options.manifestUrl) element.setAttribute("manifest-url", options.manifestUrl);
  (options.parent ?? document.body).append(element);
  return element;
}

function badge(text: string): HTMLElement {
  const element = document.createElement("span");
  element.className = "badge";
  element.textContent = text;
  return element;
}

function cssEscape(value: string): string {
  return globalThis.CSS?.escape
    ? globalThis.CSS.escape(value)
    : value.replace(/["\\]/g, "\\$&");
}

declare global {
  interface HTMLElementTagNameMap {
    "metric-atlas-overlay": MetricAtlasOverlayElement;
  }
}
