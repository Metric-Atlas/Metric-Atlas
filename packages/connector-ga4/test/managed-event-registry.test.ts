import { describe, expect, test } from "vitest";
import { MANAGED_EVENTS, resolveGa4ManagedState } from "../src/managed-event-registry.js";

describe("resolveGa4ManagedState (docs/06 §3)", () => {
  test("자동 수집 이벤트는 managed", () => {
    expect(resolveGa4ManagedState("session_start")).toBe("managed");
    expect(resolveGa4ManagedState("first_visit")).toBe("managed");
    expect(resolveGa4ManagedState("user_engagement")).toBe("managed");
    expect(resolveGa4ManagedState("page_view")).toBe("managed");
  });

  test("Enhanced Measurement 이벤트는 managed", () => {
    expect(resolveGa4ManagedState("scroll")).toBe("managed");
    expect(resolveGa4ManagedState("file_download")).toBe("managed");
    expect(resolveGa4ManagedState("video_start")).toBe("managed");
    expect(resolveGa4ManagedState("form_submit")).toBe("managed");
  });

  test("직접 계측한 커스텀 이벤트는 not_managed", () => {
    expect(resolveGa4ManagedState("purchase_click")).toBe("not_managed");
    expect(resolveGa4ManagedState("signup_complete")).toBe("not_managed");
  });

  test("Registry는 정적 목록이므로 unknown을 절대 반환하지 않는다", () => {
    for (const eventName of [...MANAGED_EVENTS, "anything_else"]) {
      expect(resolveGa4ManagedState(eventName)).not.toBe("unknown");
    }
  });
});
