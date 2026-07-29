import { describe, expect, it } from "vitest";
import { expansionFromCardDto } from "./mensaje-reserva-pedido";

describe("expansionFromCardDto", () => {
  it("prioriza setEnglishName sobre el nombre localizado en set", () => {
    expect(
      expansionFromCardDto({
        set: "SV5a(クリムゾンヘイズ)",
        setEnglishName: "Crimson Haze",
      }),
    ).toBe("Crimson Haze");
  });

  it("usa el nombre dentro de paréntesis si no hay setEnglishName", () => {
    expect(expansionFromCardDto({ set: "sv8(Surging Sparks)" })).toBe(
      "Surging Sparks",
    );
  });

  it("ignora setEnglishName vacío y cae al set localizado", () => {
    expect(
      expansionFromCardDto({
        set: "SV5a(クリムゾンヘイズ)",
        setEnglishName: "  ",
      }),
    ).toBe("クリムゾンヘイズ");
  });
});
