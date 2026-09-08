import { describe, expect, it } from "vitest";
import { ESTEBAN_STOCK_MARK, otherOwner } from "./owners";

describe("owners helpers (044)", () => {
  it("otherOwner intercambia pablo y esteban", () => {
    expect(otherOwner("pablo")).toBe("esteban");
    expect(otherOwner("esteban")).toBe("pablo");
  });

  it("marca Esteban es U+263C", () => {
    expect(ESTEBAN_STOCK_MARK).toBe("☼");
    expect(ESTEBAN_STOCK_MARK).toBe("\u263C");
  });
});
