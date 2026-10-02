/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useEventCallback } from "./use-event-callback";

describe("useEventCallback", () => {
  it("identidad estable entre renders y ejecuta la última closure", () => {
    const { result, rerender } = renderHook(
      ({ n }: { n: number }) => useEventCallback((x: number) => x + n),
      { initialProps: { n: 1 } },
    );
    const first = result.current;
    expect(first(1)).toBe(2);

    rerender({ n: 10 });
    expect(result.current).toBe(first);
    expect(first(1)).toBe(11);
  });
});
