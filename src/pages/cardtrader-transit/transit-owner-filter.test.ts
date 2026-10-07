import { describe, expect, it } from "vitest";
import { parseTransitLotOwnerFromSearch } from "./transit-owner-filter";

describe("parseTransitLotOwnerFromSearch", () => {
  it("acepta pablo y esteban", () => {
    expect(parseTransitLotOwnerFromSearch("pablo")).toBe("pablo");
    expect(parseTransitLotOwnerFromSearch("esteban")).toBe("esteban");
  });

  it("rechaza valores inválidos", () => {
    expect(parseTransitLotOwnerFromSearch(null)).toBeUndefined();
    expect(parseTransitLotOwnerFromSearch("")).toBeUndefined();
    expect(parseTransitLotOwnerFromSearch("otro")).toBeUndefined();
  });
});
