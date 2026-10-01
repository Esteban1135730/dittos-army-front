import { describe, expect, it } from "vitest";
import { isInventoryPhotoSessionState } from "./inventory-photo-session";

describe("inventory-photo-session", () => {
  it("valida estado de sesión edit/retake", () => {
    expect(
      isInventoryPhotoSessionState({
        stockId: "abc",
        mode: "edit",
        row: {
          _id: "abc",
          card_id: "sv8-1",
          card_name: "Pikachu",
          image_url: "",
          card_state: "disponible",
        },
      }),
    ).toBe(true);
    expect(isInventoryPhotoSessionState({ mode: "edit" })).toBe(false);
  });
});
