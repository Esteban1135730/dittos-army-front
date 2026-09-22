// @vitest-environment happy-dom
import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { afterEach, describe, expect, it } from "vitest";
import { dittoTheme } from "../theme";
import { CARD_THUMB_HOVER_PREVIEW, CardThumb } from "./card-thumb";

afterEach(cleanup);

function renderThumb(props: Partial<ComponentProps<typeof CardThumb>> = {}) {
  return render(
    <ThemeProvider theme={dittoTheme}>
      <div style={{ overflow: "hidden", width: 80, height: 80 }}>
        <CardThumb src="https://example.com/card.png" alt="Pikachu" {...props} />
      </div>
    </ThemeProvider>,
  );
}

describe("CardThumb", () => {
  it("no monta preview si enlargeOnHover está apagado", () => {
    renderThumb();
    fireEvent.mouseEnter(screen.getByRole("img", { name: "Pikachu" }));
    expect(screen.queryByTestId("card-thumb-preview")).toBeNull();
  });

  it("muestra la carta agrandada fuera del contenedor al hacer hover", () => {
    renderThumb({ enlargeOnHover: true });
    const thumb = screen.getByRole("img", { name: "Pikachu" });
    fireEvent.load(thumb);
    fireEvent.mouseEnter(thumb.parentElement!);

    const preview = screen.getByTestId("card-thumb-preview");
    expect(preview.getAttribute("src")).toBe("https://example.com/card.png");
    expect(preview.getAttribute("width")).toBe(
      String(CARD_THUMB_HOVER_PREVIEW.width),
    );
    expect(document.body.contains(preview)).toBe(true);
    expect(thumb.parentElement?.contains(preview)).toBe(false);
  });

  it("abre un modal grande al hacer click y se cierra con la X", async () => {
    renderThumb({ enlargeOnHover: true });
    fireEvent.load(screen.getByRole("img", { name: "Pikachu" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Ver Pikachu a tamaño grande" }),
    );

    const lightbox = screen.getByTestId("card-thumb-lightbox");
    expect(lightbox.getAttribute("src")).toBe("https://example.com/card.png");
    expect(lightbox.style.maxHeight).toBe("92dvh");

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    await waitFor(() => {
      expect(screen.queryByTestId("card-thumb-lightbox")).toBeNull();
    });
  });

  it("cierra el modal al hacer click fuera de la carta", async () => {
    renderThumb({ enlargeOnHover: true });
    fireEvent.load(screen.getByRole("img", { name: "Pikachu" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Ver Pikachu a tamaño grande" }),
    );
    expect(screen.getByTestId("card-thumb-lightbox")).toBeTruthy();

    fireEvent.click(document.querySelector(".MuiBackdrop-root")!);
    await waitFor(() => {
      expect(screen.queryByTestId("card-thumb-lightbox")).toBeNull();
    });
  });

  it("no vuelve a dejar el spinner si la imagen ya cargó y el padre re-renderiza", () => {
    const { rerender } = renderThumb();
    fireEvent.load(screen.getByRole("img", { name: "Pikachu" }));
    expect(screen.queryByRole("progressbar")).toBeNull();

    rerender(
      <ThemeProvider theme={dittoTheme}>
        <div style={{ overflow: "hidden", width: 80, height: 80 }}>
          <CardThumb src="https://example.com/card.png" alt="Pikachu" />
        </div>
      </ThemeProvider>,
    );
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("oculta el spinner si el navegador ya tiene la imagen en caché (complete)", () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLImageElement.prototype,
      "complete",
    );
    Object.defineProperty(HTMLImageElement.prototype, "complete", {
      configurable: true,
      get() {
        return true;
      },
    });
    try {
      renderThumb();
      expect(screen.queryByRole("progressbar")).toBeNull();
    } finally {
      if (descriptor) {
        Object.defineProperty(HTMLImageElement.prototype, "complete", descriptor);
      }
    }
  });
});
