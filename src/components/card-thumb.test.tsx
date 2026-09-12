// @vitest-environment happy-dom
import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
});
