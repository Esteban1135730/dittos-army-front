/** @vitest-environment happy-dom */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLaserBarcodeInput } from "./use-laser-barcode-input";

function attachInput(
  result: { current: ReturnType<typeof useLaserBarcodeInput> },
): HTMLInputElement {
  const input = document.createElement("input");
  document.body.appendChild(input);
  Object.defineProperty(result.current.inputRef, "current", {
    configurable: true,
    get: () => input,
    set: () => undefined,
  });
  return input;
}

describe("useLaserBarcodeInput", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it("no enfoca al activarse si autoFocusOnEnable es false", () => {
    const { result } = renderHook(() =>
      useLaserBarcodeInput({
        enabled: true,
        autoFocusOnEnable: false,
        onScan: () => undefined,
      }),
    );
    const input = attachInput(result);
    const focusSpy = vi.spyOn(input, "focus");

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(focusSpy).not.toHaveBeenCalled();
  });

  it("enfoca y selecciona al llamar focus()", () => {
    const { result } = renderHook(() =>
      useLaserBarcodeInput({
        enabled: true,
        autoFocusOnEnable: false,
        onScan: () => undefined,
      }),
    );
    const input = attachInput(result);
    const focusSpy = vi.spyOn(input, "focus");
    const selectSpy = vi.spyOn(input, "select");

    act(() => {
      result.current.focus();
    });

    expect(focusSpy).toHaveBeenCalledTimes(1);
    expect(selectSpy).toHaveBeenCalledTimes(1);
  });

  it("enfoca al activarse por defecto cuando el input ya está montado", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    const focusSpy = vi.spyOn(input, "focus");

    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useLaserBarcodeInput({
          enabled,
          onScan: () => undefined,
        }),
      { initialProps: { enabled: false } },
    );

    Object.defineProperty(result.current.inputRef, "current", {
      configurable: true,
      get: () => input,
      set: () => undefined,
    });

    rerender({ enabled: true });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(focusSpy).toHaveBeenCalled();
  });
});
