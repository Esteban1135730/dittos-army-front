import { describe, expect, it } from "vitest";
import { parseStockIdsQuery } from "./parse-stock-ids-query";

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
});
