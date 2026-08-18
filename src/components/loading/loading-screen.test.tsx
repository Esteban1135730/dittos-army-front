// @vitest-environment happy-dom
import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ThemeProvider } from "@mui/material/styles";
import LoadingScreen from "./loading-screen";
import { dittoTheme } from "../../theme";

function renderLoading(props: ComponentProps<typeof LoadingScreen> = {}) {
  return render(
    <ThemeProvider theme={dittoTheme}>
      <LoadingScreen {...props} />
    </ThemeProvider>,
  );
}

describe("LoadingScreen", () => {
  it("muestra marca y mensaje por defecto", () => {
    renderLoading();
    expect(screen.getByRole("status").getAttribute("aria-busy")).toBe("true");
    expect(screen.getByText("Dittos Army")).toBeTruthy();
    expect(screen.getByText("Cargando…")).toBeTruthy();
  });

  it("acepta mensaje personalizado", () => {
    renderLoading({ message: "Cargando clientes…" });
    expect(screen.getByText("Cargando clientes…")).toBeTruthy();
  });
});
