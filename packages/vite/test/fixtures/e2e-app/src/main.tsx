import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import { trackThroughWrapper } from "./wrapper";
import "./styles.css";

declare global {
  function gtag(
    command: "event",
    eventName: string,
    parameters?: Record<string, unknown>,
  ): void;

  const dataLayer: {
    push(payload: Record<string, unknown>): number;
  };

  interface Window {
    __atlasCalls: Array<Record<string, unknown>>;
  }
}

window.__atlasCalls = [];
window.gtag = (_command, eventName, parameters = {}) => {
  window.__atlasCalls.push({ emitter: "ga4", eventName, ...parameters });
};
window.dataLayer = {
  push(payload) {
    window.__atlasCalls.push({ emitter: "gtm", ...payload });
    return window.__atlasCalls.length;
  },
};

function CustomButton(props: { onClick(): void }): React.JSX.Element {
  return (
    <button id="custom-component" onClick={props.onClick}>
      Custom component
    </button>
  );
}

function App(): React.JSX.Element {
  const dynamicEventName = "dynamic_click";
  const handleLead = (event: React.FormEvent) => {
    event.preventDefault();
    dataLayer.push({ event: "lead_submit", form_type: "hero" });
  };

  return (
    <main>
      <h1>Metric Atlas B E2E</h1>
      <button
        id="purchase"
        onClick={() =>
          gtag("event", "purchase_click", { value: 100, currency: "KRW" })
        }
      >
        Purchase
      </button>
      <form id="lead" onSubmit={handleLead}>
        <button type="submit">Lead</button>
      </form>
      <CustomButton
        onClick={() => gtag("event", "custom_component_click", { slot: "hero" })}
      />
      <button
        id="dynamic"
        onClick={() => gtag("event", dynamicEventName, { placement: "body" })}
      >
        Dynamic event
      </button>
      <button id="wrapper" onClick={() => trackThroughWrapper("wrapper_click")}>
        Wrapper event
      </button>
      {createPortal(
        <button
          id="portal"
          onClick={() => gtag("event", "portal_click", { slot: "portal" })}
        >
          Portal event
        </button>,
        document.querySelector("#portal-root")!,
      )}
    </main>
  );
}

createRoot(document.querySelector("#root")!).render(<App />);
