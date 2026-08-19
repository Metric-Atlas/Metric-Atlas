import { describe, expect, test } from "vitest";
import {
  RESERVED_PARAMETERS,
  resolveParameterState,
} from "../src/reserved-parameter-registry.js";

describe("resolveParameterState (Spike §5 판정 순서)", () => {
  test("Admin custom dimension에 등록되어 있으면 registered_custom_dimension (Registry보다 우선)", () => {
    const state = resolveParameterState("campaign_slot", {
      status: "ok",
      registeredParameterNames: new Set(["campaign_slot"]),
    });
    expect(state).toBe("registered_custom_dimension");
  });

  test("등록 안 됐지만 Reserved Registry에 있으면 builtin", () => {
    const state = resolveParameterState("currency", {
      status: "ok",
      registeredParameterNames: new Set(),
    });
    expect(state).toBe("builtin");
  });

  test("등록도 안 되고 Registry에도 없으면 not_registered", () => {
    const state = resolveParameterState("campaign_slot", {
      status: "ok",
      registeredParameterNames: new Set(),
    });
    expect(state).toBe("not_registered");
  });

  test("Admin API 조회 자체가 실패하면 registeredParameterNames와 무관하게 unknown", () => {
    const state = resolveParameterState("currency", { status: "unknown" });
    expect(state).toBe("unknown");
  });

  test("registeredParameterNames가 없어도 status=ok면 not_registered/builtin 판정은 계속됨 (등록 0건)", () => {
    expect(resolveParameterState("currency", { status: "ok" })).toBe("builtin");
    expect(resolveParameterState("campaign_slot", { status: "ok" })).toBe("not_registered");
  });

  test("Registry에는 Spike §5에서 실측된 currency/value가 포함된다", () => {
    expect(RESERVED_PARAMETERS.has("currency")).toBe(true);
    expect(RESERVED_PARAMETERS.has("value")).toBe(true);
  });
});
