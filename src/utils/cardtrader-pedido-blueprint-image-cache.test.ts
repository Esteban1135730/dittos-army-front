import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cachePedidoBlueprintImage,
  clearPedidoBlueprintImageCache,
  getPedidoBlueprintImageDisplaySrc,
  PEDIDO_BLUEPRINT_IMAGE_TTL_MS,
} from "./cardtrader-pedido-blueprint-image-cache";

function mockLocalStorage() {
  const store: Record<string, string> = {};
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const key of Object.keys(store)) delete store[key];
    },
  });
}

describe("cardtrader-pedido-blueprint-image-cache", () => {
  afterEach(() => {
    clearPedidoBlueprintImageCache();
    vi.unstubAllGlobals();
  });

  it("cachea data URL 20 min al precargar blueprint", async () => {
    mockLocalStorage();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob(["x"], { type: "image/jpeg" })),
      }),
    );
    const FileReaderMock = vi.fn(function (this: {
      onload: (() => void) | null;
      readAsDataURL: () => void;
      result: string;
    }) {
      this.onload = null;
      this.result = "data:image/jpeg;base64,abc";
      this.readAsDataURL = () => {
        this.onload?.();
      };
    });
    vi.stubGlobal("FileReader", FileReaderMock);

    const dataUrl = await cachePedidoBlueprintImage(
      130752,
      "https://cdn.cardtrader.com/example.jpg",
      "http://localhost:3000",
    );
    expect(dataUrl).toMatch(/^data:image\//);
    expect(getPedidoBlueprintImageDisplaySrc(130752, null, "http://localhost:3000")).toBe(
      dataUrl,
    );
    expect(PEDIDO_BLUEPRINT_IMAGE_TTL_MS).toBe(20 * 60 * 1000);
  });
});
