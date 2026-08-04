import { describe, expect, it } from "vitest";
import {
  THERMAL_QR_LABEL_HEIGHT_MM,
  THERMAL_QR_LABEL_WIDTH_MM,
} from "./export-stock-qr-labels";

describe("thermal QR label size constants", () => {
  it("usa 50×25 mm (medido en 632-L58P)", () => {
    expect(THERMAL_QR_LABEL_WIDTH_MM).toBe(50);
    expect(THERMAL_QR_LABEL_HEIGHT_MM).toBe(25);
  });
});
