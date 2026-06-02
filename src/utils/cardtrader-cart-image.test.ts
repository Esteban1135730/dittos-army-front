import { afterEach, describe, expect, it, vi } from "vitest";
import {
  resolveCartThumbnailSrc,
  upsertCardtraderCartMetaWithImage,
} from "./cardtrader-cart-image";
import { loadCardtraderCartMetaCache } from "./cardtrader-cart-meta-cache";

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

describe("resolveCartThumbnailSrc", () => {
  it("prioriza imageDataUrl y luego proxy", () => {
    expect(
      resolveCartThumbnailSrc({
        productId: 1,
        imageDataUrl: "data:image/jpeg;base64,abc",
        imageUrl: "https://cdn.cardtrader.com/x.jpg",
        apiBase: "http://localhost:3000",
      }),
    ).toBe("data:image/jpeg;base64,abc");

    expect(
      resolveCartThumbnailSrc({
        productId: 2,
        imageUrl: "https://cdn.cardtrader.com/y.jpg",
        apiBase: "http://localhost:3000/",
      }),
    ).toBe(
      "http://localhost:3000/cardtrader/images/proxy?url=https%3A%2F%2Fcdn.cardtrader.com%2Fy.jpg",
    );
  });
});

describe("upsertCardtraderCartMetaWithImage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("guarda imageDataUrl en localStorage tras el proxy", async () => {
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
      this.result = "data:image/jpeg;base64,YQ==";
      this.readAsDataURL = () => {
        this.onload?.();
      };
    });
    vi.stubGlobal("FileReader", FileReaderMock);

    await upsertCardtraderCartMetaWithImage(
      42,
      { name: "Test", imageUrl: "https://cdn.cardtrader.com/example.jpg" },
      "http://localhost:3000",
    );

    const cached = loadCardtraderCartMetaCache()[42];
    expect(cached?.imageUrl).toContain("cardtrader.com");
    expect(cached?.imageDataUrl).toMatch(/^data:image\//);
  });
});
