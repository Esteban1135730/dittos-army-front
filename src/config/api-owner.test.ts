import { describe, expect, it } from "vitest";
import { resolveAxiosOwner } from "./api";

describe("resolveAxiosOwner", () => {
  it("usa ownerOverride esteban si viene en el request", () => {
    expect(resolveAxiosOwner({ ownerOverride: "esteban" }, "pablo")).toBe(
      "esteban",
    );
  });

  it("sin override usa el owner activo", () => {
    expect(resolveAxiosOwner({}, "pablo")).toBe("pablo");
    expect(resolveAxiosOwner({}, "esteban")).toBe("esteban");
  });
});
