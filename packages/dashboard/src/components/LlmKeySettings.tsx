import { useState } from "react";
import { C } from "../labels";
import { card, fieldLabel, input, sectionTitle } from "../ui";
import { LLM_PROVIDER_DEFAULTS, type BrowserLlmKey, type LlmProvider } from "../llmClient";

const PROVIDERS: LlmProvider[] = ["openai", "anthropic"];

/**
 * 서버 환경변수(METRIC_ATLAS_LLM_API_KEY)가 없을 때만 노출되는 BYOK 입력 패널.
 * docs/09-security-and-secrets.md, ADR-004, docs/contract-inputs/d-runtime-auth-deployment-options.md #7에 따라
 * localStorage/sessionStorage에는 절대 쓰지 않는다 — React state(이 컴포넌트의 부모)에만 머무르고 새로고침하면 사라진다.
 */
export function LlmKeySettings(props: {
  value: BrowserLlmKey | null;
  onSave: (key: BrowserLlmKey) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [provider, setProvider] = useState<LlmProvider>(props.value?.provider ?? "openai");
  const [apiKey, setApiKey] = useState(props.value?.apiKey ?? "");
  const [baseUrl, setBaseUrl] = useState(props.value?.baseUrl ?? "");
  const [model, setModel] = useState(props.value?.model ?? "");
  const defaults = LLM_PROVIDER_DEFAULTS[provider];

  const changeProvider = (next: LlmProvider) => {
    setProvider(next);
    setBaseUrl("");
    setModel("");
  };

  const save = () => {
    const trimmed = apiKey.trim();
    if (!trimmed) return;
    props.onSave({
      provider,
      apiKey: trimmed,
      baseUrl: baseUrl.trim() || defaults.baseUrl,
      model: model.trim() || defaults.model
    });
    props.onClose();
  };

  return (
    <div style={{ ...card, borderColor: C.accentLine, background: C.accentBg }}>
      <h3 style={sectionTitle}>내 LLM 키로 직접 호출</h3>
      <p style={{ fontSize: 11.5, color: "#3a3d5c", lineHeight: 1.6, margin: "8px 0 12px" }}>
        이 키는 어디에도 저장되지 않고 이 브라우저 탭의 메모리에만 남습니다. 새로고침하면 사라져요.
        저장하면 이 화면은 Runtime 서버를 거치지 않고 이 브라우저에서 provider의 API로 직접 요청을 보냅니다.
        호출 비용과 남용 책임은 키를 입력한 본인에게 있습니다.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        <div>
          <div style={fieldLabel}>PROVIDER</div>
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            {PROVIDERS.map((p) => {
              const on = provider === p;
              return (
                <button
                  key={p}
                  onClick={() => changeProvider(p)}
                  style={{
                    flex: 1, border: `1px solid ${on ? C.accentLine : C.line}`, borderRadius: 8,
                    padding: "8px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                    background: on ? C.ink : C.surface, color: on ? "#fff" : C.muted
                  }}
                >
                  {LLM_PROVIDER_DEFAULTS[p].label}
                </button>
              );
            })}
          </div>
        </div>
        <label>
          <div style={fieldLabel}>API KEY</div>
          <input
            style={{ ...input, marginTop: 4 }}
            type="password"
            autoFocus
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={provider === "anthropic" ? "sk-ant-..." : "sk-..."}
          />
        </label>
        <label>
          <div style={fieldLabel}>BASE URL (선택, 기본 {defaults.baseUrl})</div>
          <input
            style={{ ...input, marginTop: 4 }}
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={defaults.baseUrl}
          />
        </label>
        <label>
          <div style={fieldLabel}>MODEL (선택, 기본 {defaults.model})</div>
          <input
            style={{ ...input, marginTop: 4 }}
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={defaults.model}
          />
        </label>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 13 }}>
        <button
          onClick={save}
          disabled={!apiKey.trim()}
          style={{
            border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 12.5, fontWeight: 700,
            cursor: apiKey.trim() ? "pointer" : "not-allowed",
            background: apiKey.trim() ? C.ink : "#d9d9d2", color: "#fff"
          }}
        >
          이 탭에서만 사용
        </button>
        {props.value && (
          <button
            onClick={() => {
              props.onClear();
              props.onClose();
            }}
            style={{
              border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 14px", fontSize: 12.5, fontWeight: 700,
              cursor: "pointer", background: C.surface, color: C.red
            }}
          >
            키 지우기
          </button>
        )}
        <button
          onClick={props.onClose}
          style={{
            border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 14px", fontSize: 12.5, fontWeight: 700,
            cursor: "pointer", background: C.surface, color: C.muted
          }}
        >
          닫기
        </button>
      </div>
    </div>
  );
}
