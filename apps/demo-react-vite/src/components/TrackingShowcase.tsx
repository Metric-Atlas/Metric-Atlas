import type { FormEvent } from "react";
import { C } from "../labels";
import { card } from "../ui";

function gtag(
  command: "event",
  eventName: string,
  parameters: Record<string, unknown>,
): void {
  window.dispatchEvent(
    new CustomEvent("metric-atlas:demo-event", {
      detail: { command, eventName, parameters },
    }),
  );
}

const dataLayer = {
  push(payload: Record<string, unknown>): number {
    window.dispatchEvent(
      new CustomEvent("metric-atlas:demo-event", { detail: payload }),
    );
    return 1;
  },
};

export function TrackingShowcase() {
  const handleLead = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    dataLayer.push({
      event: "demo_lead_submit",
      form_type: "dashboard_showcase",
    });
  };

  return (
    <section
      aria-labelledby="tracking-showcase-title"
      style={{
        ...card,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div style={{ flex: "1 1 300px" }}>
        <h2 id="tracking-showcase-title" style={{ margin: 0, fontSize: 13 }}>
          Overlay tracking showcase
        </h2>
        <p style={{ margin: "4px 0 0", color: C.muted, fontSize: 11.5 }}>
          로컬 이벤트만 발생시키며 외부 Analytics API로 전송하지 않습니다.
        </p>
      </div>
      <button
        id="demo-purchase"
        type="button"
        onClick={() =>
          gtag("event", "demo_purchase_click", {
            placement: "dashboard_header",
          })
        }
      >
        GA4 demo event
      </button>
      <form id="demo-lead-form" onSubmit={handleLead}>
        <button id="demo-lead" type="submit">
          GTM demo event
        </button>
      </form>
    </section>
  );
}
