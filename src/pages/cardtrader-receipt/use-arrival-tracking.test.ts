/** @vitest-environment happy-dom */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useArrivalTracking } from "./use-arrival-tracking";

const STORAGE_PREFIX = "dittos-army.ct-receipt-arrived.v1";
const SESSION_ID = "session-abc";

function storageKey(sessionId: string): string {
  return `${STORAGE_PREFIX}:${sessionId}`;
}

describe("useArrivalTracking", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts empty when no storage / no sessionId", () => {
    const withoutSession = renderHook(() => useArrivalTracking(undefined));
    expect(withoutSession.result.current.arrivedCount).toBe(0);
    expect(withoutSession.result.current.arrivedKeys.size).toBe(0);
    expect(withoutSession.result.current.isArrived("any")).toBe(false);

    const withSession = renderHook(() => useArrivalTracking(SESSION_ID));
    expect(withSession.result.current.arrivedCount).toBe(0);
    expect(withSession.result.current.arrivedKeys.size).toBe(0);
    expect(localStorage.getItem(storageKey(SESSION_ID))).toBeNull();
  });

  it("toggleArrived adds and removes keys", () => {
    const { result } = renderHook(() => useArrivalTracking(SESSION_ID));

    act(() => {
      result.current.toggleArrived("unit-1");
    });
    expect(result.current.isArrived("unit-1")).toBe(true);
    expect(result.current.arrivedCount).toBe(1);

    act(() => {
      result.current.toggleArrived("unit-1");
    });
    expect(result.current.isArrived("unit-1")).toBe(false);
    expect(result.current.arrivedCount).toBe(0);
  });

  it("markMany marks multiple", () => {
    const { result } = renderHook(() => useArrivalTracking(SESSION_ID));

    act(() => {
      result.current.markMany(["a", "b", "c"]);
    });

    expect(result.current.arrivedCount).toBe(3);
    expect(result.current.isArrived("a")).toBe(true);
    expect(result.current.isArrived("b")).toBe(true);
    expect(result.current.isArrived("c")).toBe(true);

    act(() => {
      result.current.markMany(["b", "d"]);
    });

    expect(result.current.arrivedCount).toBe(4);
    expect(result.current.isArrived("d")).toBe(true);
  });

  it("clearArrived empties", () => {
    const { result } = renderHook(() => useArrivalTracking(SESSION_ID));

    act(() => {
      result.current.markMany(["x", "y"]);
    });
    expect(result.current.arrivedCount).toBe(2);

    act(() => {
      result.current.clearArrived();
    });
    expect(result.current.arrivedCount).toBe(0);
    expect(result.current.arrivedKeys.size).toBe(0);
    expect(result.current.isArrived("x")).toBe(false);
  });

  it("persists to localStorage under key with sessionId", () => {
    const { result } = renderHook(() => useArrivalTracking(SESSION_ID));

    act(() => {
      result.current.toggleArrived("persisted-1");
    });
    act(() => {
      result.current.markArrived("persisted-2");
    });

    const raw = localStorage.getItem(storageKey(SESSION_ID));
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as string[];
    expect(parsed).toEqual(expect.arrayContaining(["persisted-1", "persisted-2"]));
    expect(parsed).toHaveLength(2);

    act(() => {
      result.current.clearArrived();
    });
    expect(JSON.parse(localStorage.getItem(storageKey(SESSION_ID))!)).toEqual([]);
  });

  it("reloads from localStorage when sessionId is set", () => {
    localStorage.setItem(
      storageKey(SESSION_ID),
      JSON.stringify(["preloaded-a", "preloaded-b"]),
    );

    const { result } = renderHook(() => useArrivalTracking(SESSION_ID));

    expect(result.current.arrivedCount).toBe(2);
    expect(result.current.isArrived("preloaded-a")).toBe(true);
    expect(result.current.isArrived("preloaded-b")).toBe(true);
    expect(result.current.isArrived("missing")).toBe(false);
  });
});
