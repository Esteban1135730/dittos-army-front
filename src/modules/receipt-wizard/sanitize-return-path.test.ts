import { describe, expect, it } from "vitest";
import { sanitizeReturnPath } from "./sanitize-return-path";

describe("sanitizeReturnPath", () => {
  it("acepta path relativo interno", () => {
    expect(
      sanitizeReturnPath("/cardtrader-receipt?step=3&session=abc"),
    ).toBe("/cardtrader-receipt?step=3&session=abc");
  });

  it("acepta valor urlencoded", () => {
    expect(
      sanitizeReturnPath(
        encodeURIComponent("/cardtrader-receipt?step=3&session=abc"),
      ),
    ).toBe("/cardtrader-receipt?step=3&session=abc");
  });

  it("rechaza open redirect", () => {
    expect(sanitizeReturnPath("//evil.com")).toBe("/cardtrader-receipt");
    expect(sanitizeReturnPath("https://evil.com")).toBe("/cardtrader-receipt");
    expect(sanitizeReturnPath("javascript:alert(1)")).toBe(
      "/cardtrader-receipt",
    );
  });

  it("usa fallback custom", () => {
    expect(sanitizeReturnPath(null, "/stock")).toBe("/stock");
    expect(sanitizeReturnPath("", "/stock")).toBe("/stock");
  });
});
