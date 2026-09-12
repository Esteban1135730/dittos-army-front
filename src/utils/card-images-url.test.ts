import { describe, expect, it } from "vitest";
import { isLocalCardImagesUrl, rewriteCardImagesUrl } from "./card-images-url";

function apiUrl(path: string): string {
  return `https://api.example${path}`;
}

describe("rewriteCardImagesUrl", () => {
  it("reescribe ruta relativa /card-images", () => {
    expect(rewriteCardImagesUrl("/card-images/swsh3/swsh3-136.png", apiUrl)).toBe(
      "https://api.example/card-images/swsh3/swsh3-136.png",
    );
  });

  it("reescribe localhost y 127.0.0.1 con puerto", () => {
    expect(
      rewriteCardImagesUrl(
        "http://localhost:3000/card-images/swsh3/a.png",
        apiUrl,
      ),
    ).toBe("https://api.example/card-images/swsh3/a.png");
    expect(
      rewriteCardImagesUrl(
        "http://127.0.0.1:3000/card-images/swsh3/a.png",
        apiUrl,
      ),
    ).toBe("https://api.example/card-images/swsh3/a.png");
  });

  it("no toca CDN ni dummy bulk", () => {
    expect(
      rewriteCardImagesUrl(
        "https://assets.tcgdex.net/en/swsh3/136/low.png",
        apiUrl,
      ),
    ).toBe("https://assets.tcgdex.net/en/swsh3/136/low.png");
    expect(rewriteCardImagesUrl("/bulk-dummy.svg", apiUrl)).toBe(
      "/bulk-dummy.svg",
    );
  });

  it("isLocalCardImagesUrl detecta caché local, no CDN", () => {
    expect(isLocalCardImagesUrl("/card-images/me03/me03-117.png")).toBe(true);
    expect(
      isLocalCardImagesUrl("http://localhost:3000/card-images/me03/me03-117.png"),
    ).toBe(true);
    expect(
      isLocalCardImagesUrl("https://assets.tcgdex.net/en/me/me03/117/low.png"),
    ).toBe(false);
    expect(isLocalCardImagesUrl("/bulk-dummy.svg")).toBe(false);
  });
});
