import { describe, expect, it } from "vitest";
import {
  ESTEBAN_STOCK_MARK,
  coerceOwnerForTcg,
  defaultOwnerForTcg,
  otherOwner,
  ownersForTcg,
} from "./owners";

describe("owners helpers (044)", () => {
  it("otherOwner intercambia pablo y esteban; tefa sin par", () => {
    expect(otherOwner("pablo")).toBe("esteban");
    expect(otherOwner("esteban")).toBe("pablo");
    expect(otherOwner("tefa")).toBeNull();
  });

  it("Yu-Gi-Oh solo Tefa; Pokémon Pablo/Esteban", () => {
    expect(ownersForTcg("yugioh").map((o) => o.key)).toEqual(["tefa"]);
    expect(ownersForTcg("pokemon").map((o) => o.key)).toEqual([
      "pablo",
      "esteban",
    ]);
    expect(defaultOwnerForTcg("yugioh")).toBe("tefa");
    expect(coerceOwnerForTcg("pablo", "yugioh")).toBe("tefa");
  });

  it("marca Esteban es U+263C", () => {
    expect(ESTEBAN_STOCK_MARK).toBe("☼");
    expect(ESTEBAN_STOCK_MARK).toBe("\u263C");
  });
});
