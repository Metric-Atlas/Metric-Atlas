export function SupportedPatterns() {
  const handleSubmit = () => {
    const extra = { campaign: "summer" };
    dataLayer.push({ event: "lead_submit", form_type: "hero", ...extra });
  };

  return (
    <>
      <button
        onClick={() => {
          gtag("event", "purchase_click", { value: 100, currency: "KRW" });
          sendGAEvent("event", "purchase_click", { placement: "hero" });
        }}
      >
        Buy
      </button>
      <form onSubmit={handleSubmit}>Lead</form>
      <Card
        onClick={() =>
          gtag("event", "custom_card_click", { card_id: "welcome" })
        }
      />
      {createPortal(
        <a onClick={() => posthog.capture("portal_click", { slot: "footer" })}>
          Portal
        </a>,
        document.body,
      )}
    </>
  );
}
