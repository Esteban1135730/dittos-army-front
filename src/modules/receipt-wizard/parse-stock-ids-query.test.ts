import { describe, expect, it } from "vitest";
import { parseStockIdsQuery, parseStockOwnersQuery } from "./parse-stock-ids-query";

describe("parseStockIdsQuery", () => {
  it("parsea ids válidos y dedupe", () => {
    const a = "507f1f77bcf86cd799439011";
    const b = "507f191e810c19729de860ea";
    expect(parseStockIdsQuery(`${a},${b},${a}`)).toEqual([a, b]);
  });

  it("ignora inválidos y vacío", () => {
    expect(parseStockIdsQuery("")).toEqual([]);
    expect(parseStockIdsQuery(null)).toEqual([]);
    expect(parseStockIdsQuery("not-an-id,507f1f77bcf86cd799439011")).toEqual([
      "507f1f77bcf86cd799439011",
    ]);
  });

  it("tolera espacios", () => {
    expect(
      parseStockIdsQuery(" 507f1f77bcf86cd799439011 , 507f191e810c19729de860ea "),
    ).toEqual(["507f1f77bcf86cd799439011", "507f191e810c19729de860ea"]);
  });

  it("normaliza a minúsculas", () => {
    expect(parseStockIdsQuery("507F1F77BCF86CD799439011")).toEqual([
      "507f1f77bcf86cd799439011",
    ]);
  });
});

describe("parseStockOwnersQuery", () => {
  it("sin raw devuelve pablo por cada id", () => {
    expect(parseStockOwnersQuery(null, 2)).toEqual(["pablo", "pablo"]);
    expect(parseStockOwnersQuery("", 1)).toEqual(["pablo"]);
    expect(parseStockOwnersQuery("  ", 0)).toEqual([]);
  });

  it("parsea owners válidos", () => {
    expect(parseStockOwnersQuery("pablo,esteban", 2)).toEqual([
      "pablo",
      "esteban",
    ]);
  });

  it("owners inválidos caen a pablo", () => {
    expect(parseStockOwnersQuery("esteban,otro,pablo", 3)).toEqual([
      "esteban",
      "pablo",
      "pablo",
    ]);
  });

  it("pad con pablo si hay menos owners que ids", () => {
    expect(parseStockOwnersQuery("esteban", 3)).toEqual([
      "esteban",
      "pablo",
      "pablo",
    ]);
  });

  it("trunca si hay más owners que ids", () => {
    expect(parseStockOwnersQuery("pablo,esteban,pablo", 2)).toEqual([
      "pablo",
      "esteban",
    ]);
  });
});
