/**
 * Paleta Ditto Army — panel interno TCG.
 * Usar vía MUI theme (`theme.palette.ditto`) o import directo solo en theme/tests.
 */
export const dittoPalette = {
  brand: {
    ink: "#1E1B2E",
    lilac: "#6D5CE8",
    lilacLight: "#9B8FF0",
    lilacDark: "#4E42B8",
    blush: "#E879A8",
    blushLight: "#F3D4E3",
  },
  surface: {
    page: "#F7F5F2",
    paper: "#FFFFFF",
    muted: "#F0EDE8",
    elevated: "#FAFAF8",
  },
  text: {
    primary: "#1A1625",
    secondary: "#6B6578",
    muted: "#9B95A8",
  },
  border: {
    default: "#E4DFD6",
    strong: "#D4CEC4",
  },
  semantic: {
    success: "#2A9D8F",
    successBg: "rgba(42, 157, 143, 0.12)",
    successBorder: "rgba(42, 157, 143, 0.35)",
    warning: "#D4890A",
    warningBg: "rgba(212, 137, 10, 0.14)",
    warningBorder: "rgba(212, 137, 10, 0.35)",
    error: "#DC4A4A",
    errorBg: "rgba(220, 74, 74, 0.12)",
    errorBorder: "rgba(220, 74, 74, 0.35)",
    info: "#5B7FD4",
    infoBg: "rgba(91, 127, 212, 0.12)",
  },
  nav: {
    bg: "#1E1B2E",
    bgTop: "#2A2640",
    text: "rgba(255, 255, 255, 0.72)",
    textActive: "#FFFFFF",
    accent: "#9B8FF0",
    border: "rgba(255, 255, 255, 0.08)",
  },
} as const;

export type DittoPalette = typeof dittoPalette;
