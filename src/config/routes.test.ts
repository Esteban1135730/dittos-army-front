import { describe, expect, it } from "vitest";
import { PANEL_UI_PREFIX, panelPath, panelBasenameForPath } from "./routes";

describe("panelPath", () => {
  it("antepone /pokemon", () => {
    expect(panelPath("/")).toBe(PANEL_UI_PREFIX);
    expect(panelPath("/stock")).toBe(`${PANEL_UI_PREFIX}/stock`);
    expect(panelPath(`${PANEL_UI_PREFIX}/ventas`)).toBe(
      `${PANEL_UI_PREFIX}/ventas`,
    );
  });

  it("reconoce /yugioh sin mandarlo a /pokemon", () => {
    expect(panelBasenameForPath("/yugioh")).toBe("/yugioh");
    expect(panelBasenameForPath("/yugioh/stock")).toBe("/yugioh");
    expect(panelBasenameForPath("/pokemon/stock")).toBe("/pokemon");
    expect(panelBasenameForPath("/stock")).toBeNull();
  });
});
