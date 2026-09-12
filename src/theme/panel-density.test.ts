import { describe, expect, it } from "vitest";
import {
  PANEL_DATAGRID_DENSITY,
  PANEL_DATAGRID_ROW_HEIGHT,
  PANEL_DRAWER_WIDTH_PX,
  PANEL_MAIN_PADDING,
} from "./panel-density";

describe("panel density tokens (045)", () => {
  it("drawer width es 232 (no 280)", () => {
    expect(PANEL_DRAWER_WIDTH_PX).toBe(232);
    expect(PANEL_DRAWER_WIDTH_PX).not.toBe(280);
  });

  it("rowHeight es 76 (entre 64 y 88)", () => {
    expect(PANEL_DATAGRID_ROW_HEIGHT).toBe(76);
    expect(PANEL_DATAGRID_ROW_HEIGHT).toBeGreaterThanOrEqual(64);
    expect(PANEL_DATAGRID_ROW_HEIGHT).toBeLessThanOrEqual(88);
  });

  it("density es compact", () => {
    expect(PANEL_DATAGRID_DENSITY).toBe("compact");
  });

  it("main padding md es como máximo 1.5", () => {
    expect(PANEL_MAIN_PADDING.md).toBeLessThanOrEqual(1.5);
  });
});
