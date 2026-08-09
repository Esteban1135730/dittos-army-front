import { describe, expect, it } from "vitest";
import { isQrEligible } from "./is-qr-eligible";

describe("isQrEligible", () => {
  it("cruza stock id con set de qr-export", () => {
    const eligible = new Set(["a", "b"]);
    expect(isQrEligible("a", eligible)).toBe(true);
    expect(isQrEligible("c", eligible)).toBe(false);
  });

  it("compara ObjectId sin importar mayúsculas", () => {
    const id = "507f1f77bcf86cd799439011";
    const eligible = new Set([id]);
    expect(isQrEligible(id.toUpperCase(), eligible)).toBe(true);
  });
});
