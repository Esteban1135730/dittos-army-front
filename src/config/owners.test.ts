import { describe, expect, it } from "vitest";
import {
  ESTEBAN_STOCK_MARK,
  OWNERS_CONFIG,
  coerceOwnerForTcg,
  defaultOwnerForTcg,
  getOwnerDefinition,
  isOwnerKey,
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

  it("Magic solo Pablo (pablo-magic); One Piece solo Ali", () => {
    expect(ownersForTcg("magic").map((o) => o.key)).toEqual(["pablo-magic"]);
    expect(ownersForTcg("onepiece").map((o) => o.key)).toEqual(["ali"]);
    expect(getOwnerDefinition("pablo-magic")).toMatchObject({
      label: "Pablo",
      dbName: "magic-pablo",
      stockQrPrefix: "MAGIC-STOCK:",
    });
    expect(getOwnerDefinition("ali")).toMatchObject({
      dbName: "onepiece-ali",
      stockQrPrefix: "ALI-STOCK:",
    });
    expect(coerceOwnerForTcg("pablo", "magic")).toBe("pablo-magic");
    expect(coerceOwnerForTcg("tefa", "onepiece")).toBe("ali");
    expect(otherOwner("ali")).toBeNull();
    expect(isOwnerKey("pablo-magic")).toBe(true);
    expect(isOwnerKey("otro")).toBe(false);
  });

  it("Pablo y Esteban incluyen stock-inventario-fotos", () => {
    expect(OWNERS_CONFIG.owners.pablo.allowedFeatures).toContain(
      "stock-inventario-fotos",
    );
    expect(OWNERS_CONFIG.owners.esteban.allowedFeatures).toContain(
      "stock-inventario-fotos",
    );
  });

  it("marca Esteban es U+263C", () => {
    expect(ESTEBAN_STOCK_MARK).toBe("☼");
    expect(ESTEBAN_STOCK_MARK).toBe("\u263C");
  });
});
