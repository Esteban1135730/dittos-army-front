import { describe, expect, it, vi } from "vitest";
import {
  buildStockByOwnerId,
  lookupStockForReserva,
  resolvePedidoReservaVisual,
  resolveReservaOwner,
  stockOwnerKey,
} from "./pedido-reserva-visual";

vi.mock("../../config/api", () => ({
  apiUrl: (path: string) => `https://api.test${path.startsWith("/") ? path : `/${path}`}`,
}));

describe("pedido-reserva-visual", () => {
  it("resolveReservaOwner usa stock_owner o el owner activo", () => {
    expect(resolveReservaOwner("esteban", "pablo")).toBe("esteban");
    expect(resolveReservaOwner(undefined, "pablo")).toBe("pablo");
    expect(resolveReservaOwner("otro", "esteban")).toBe("esteban");
  });

  it("lookupStockForReserva distingue el mismo _id en otra DB", () => {
    const map = buildStockByOwnerId([
      {
        owner: "pablo",
        rows: [{ _id: "abc", card_name: "Pikachu Pablo" }],
      },
      {
        owner: "esteban",
        rows: [{ _id: "abc", card_name: "Pikachu Esteban" }],
      },
    ]);
    expect(stockOwnerKey("esteban", "abc")).toBe("esteban:abc");
    expect(lookupStockForReserva(map, "abc", "esteban", "pablo")?.card_name).toBe(
      "Pikachu Esteban",
    );
    expect(lookupStockForReserva(map, "abc", undefined, "pablo")?.card_name).toBe(
      "Pikachu Pablo",
    );
    expect(lookupStockForReserva(map, "missing", "esteban", "pablo")).toBeUndefined();
  });

  it("resolvePedidoReservaVisual prioriza stock del owner", () => {
    const visual = resolvePedidoReservaVisual({
      stock: {
        card_id: "sv8-1",
        card_name: "Pikachu",
        image_url: "https://cdn.example/pika.png",
        rareza: "RR",
      },
      pedidoLine: {
        card_id: "sv8-1",
        card_name: "Fallback",
        image_url: "/card-images/old.png",
      },
      stockOwner: "esteban",
      activeOwner: "pablo",
    });
    expect(visual.cardName).toBe("Pikachu");
    expect(visual.imageSrc).toBe("https://cdn.example/pika.png");
    expect(visual.lineOwner).toBe("esteban");
    expect(visual.rareza).toBe("RR");
  });

  it("cae a la línea del pedido y reescribe /card-images/", () => {
    const visual = resolvePedidoReservaVisual({
      pedidoLine: {
        card_id: "sv8-194",
        card_name: "Pikachu ex",
        image_url: "/card-images/sv8/sv8-194.png",
      },
      stockOwner: "esteban",
      activeOwner: "pablo",
    });
    expect(visual.cardName).toBe("Pikachu ex");
    expect(visual.cardId).toBe("sv8-194");
    expect(visual.imageSrc).toBe("https://api.test/card-images/sv8/sv8-194.png");
    expect(visual.lineOwner).toBe("esteban");
  });

  it("cae a TCGdex si no hay imagen de stock ni de línea", () => {
    const visual = resolvePedidoReservaVisual({
      pedidoLine: { card_id: "me05-066", card_name: "" },
      tcg: { name: "Pikipek", imageUrl: "https://tcgdex.example/pikipek.png" },
      activeOwner: "pablo",
    });
    expect(visual.cardName).toBe("Pikipek");
    expect(visual.imageSrc).toBe("https://tcgdex.example/pikipek.png");
  });
});
