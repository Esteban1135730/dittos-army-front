import { describe, expect, it } from "vitest";
import { isQrEligible } from "./is-qr-eligible";

describe("isQrEligible", () => {
  it("cruza stock id con set de qr-export", () => {
    const eligible = new Set(["a", "b"]);
    expect(isQrEligible("a", eligible)).toBe(true);
    expect(isQrEligible("c", eligible)).toBe(false);
  });
});
