import { describe, expect, it } from "vitest";
import { cartVariantLabelsFromPropertiesHash } from "./cardtrader-cart-variants";

describe("cartVariantLabelsFromPropertiesHash", () => {
  it("devuelve vacío si no hay hash", () => {
    expect(cartVariantLabelsFromPropertiesHash(undefined)).toEqual([]);
    expect(cartVariantLabelsFromPropertiesHash(null)).toEqual([]);
    expect(cartVariantLabelsFromPropertiesHash({})).toEqual([]);
  });

  it("no trata condition ni language como variante", () => {
    expect(
      cartVariantLabelsFromPropertiesHash({
        condition: "Near Mint",
        pokemon_language: "en",
        pokemon_rarity: "Rare",
      }),
    ).toEqual([]);
  });

  it("etiqueta Pokeball y Masterball por separado", () => {
    expect(
      cartVariantLabelsFromPropertiesHash({ poke_ball_reverse_holo: true }),
    ).toEqual(["Pokeball"]);
    expect(
      cartVariantLabelsFromPropertiesHash({ master_ball_reverse_holo: true }),
    ).toEqual(["Masterball"]);
  });

  it("prioriza pokeball/masterball sobre reverse genérico", () => {
    expect(
      cartVariantLabelsFromPropertiesHash({
        poke_ball_reverse_holo: true,
        reverse: true,
      }),
    ).toEqual(["Pokeball"]);
    expect(
      cartVariantLabelsFromPropertiesHash({
        master_ball_reverse_holo: true,
        reverse_holo: "true",
      }),
    ).toEqual(["Masterball"]);
  });

  it("etiqueta Reverse genérico", () => {
    expect(cartVariantLabelsFromPropertiesHash({ reverse: true })).toEqual(["Reverse"]);
    expect(cartVariantLabelsFromPropertiesHash({ pokemon_reverse: true })).toEqual([
      "Reverse",
    ]);
    expect(cartVariantLabelsFromPropertiesHash({ reverse_holo: true })).toEqual(["Reverse"]);
  });

  it("etiqueta Hollow para foil genérico y Holofoil para clave holofoil", () => {
    expect(cartVariantLabelsFromPropertiesHash({ foil: true })).toEqual(["Hollow"]);
    expect(cartVariantLabelsFromPropertiesHash({ pokemon_foil: true })).toEqual(["Hollow"]);
    expect(cartVariantLabelsFromPropertiesHash({ mtg_foil: true })).toEqual(["Hollow"]);
    expect(cartVariantLabelsFromPropertiesHash({ fab_foil: true })).toEqual(["Hollow"]);
    expect(cartVariantLabelsFromPropertiesHash({ holo: true })).toEqual(["Hollow"]);
    expect(cartVariantLabelsFromPropertiesHash({ pokemon_holo: true })).toEqual(["Hollow"]);
    expect(cartVariantLabelsFromPropertiesHash({ holofoil: true })).toEqual(["Holofoil"]);
  });

  it("prefiere Holofoil si holofoil y foil genérico coexisten", () => {
    expect(
      cartVariantLabelsFromPropertiesHash({ holofoil: true, foil: true }),
    ).toEqual(["Holofoil"]);
  });

  it("etiqueta First edition y permite combinaciones", () => {
    expect(cartVariantLabelsFromPropertiesHash({ first_edition: true })).toEqual([
      "First edition",
    ]);
    expect(
      cartVariantLabelsFromPropertiesHash({
        first_edition: true,
        reverse: true,
      }),
    ).toEqual(["First edition", "Reverse"]);
  });

  it("incluye Signed, Altered y Graded cuando están activos", () => {
    expect(
      cartVariantLabelsFromPropertiesHash({
        signed: true,
        altered: true,
        graded: true,
      }),
    ).toEqual(["Signed", "Altered", "Graded"]);
  });
});
