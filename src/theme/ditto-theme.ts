import { createTheme } from "@mui/material/styles";
import { dittoPalette } from "./ditto-palette";

export const dittoTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: dittoPalette.brand.lilac,
      light: dittoPalette.brand.lilacLight,
      dark: dittoPalette.brand.lilacDark,
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: dittoPalette.brand.blush,
      light: dittoPalette.brand.blushLight,
      dark: "#C95688",
      contrastText: dittoPalette.text.primary,
    },
    success: {
      main: dittoPalette.semantic.success,
      contrastText: "#FFFFFF",
    },
    warning: {
      main: dittoPalette.semantic.warning,
      contrastText: "#FFFFFF",
    },
    error: {
      main: dittoPalette.semantic.error,
      contrastText: "#FFFFFF",
    },
    info: {
      main: dittoPalette.semantic.info,
      contrastText: "#FFFFFF",
    },
    background: {
      default: dittoPalette.surface.page,
      paper: dittoPalette.surface.paper,
    },
    text: {
      primary: dittoPalette.text.primary,
      secondary: dittoPalette.text.secondary,
    },
    divider: dittoPalette.border.default,
    grey: {
      50: dittoPalette.surface.muted,
      100: dittoPalette.surface.elevated,
      800: dittoPalette.nav.bg,
      900: dittoPalette.brand.ink,
    },
    ditto: dittoPalette,
  },
  typography: {
    fontFamily: '"DM Sans", "Segoe UI", system-ui, sans-serif',
    h4: { fontWeight: 800, letterSpacing: "-0.02em", color: dittoPalette.text.primary },
    h5: { fontWeight: 700, letterSpacing: "-0.01em" },
    h6: { fontWeight: 700 },
    subtitle1: { fontWeight: 700 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: dittoPalette.surface.page,
          color: dittoPalette.text.primary,
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: "none",
          fontWeight: 600,
        },
        containedSuccess: {
          backgroundColor: dittoPalette.semantic.success,
          "&:hover": { backgroundColor: "#238B7F" },
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
        },
        colorPrimary: {
          backgroundColor: dittoPalette.brand.lilacLight,
          color: dittoPalette.brand.lilacDark,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          minHeight: 40,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        standardSuccess: {
          backgroundColor: dittoPalette.semantic.successBg,
          color: dittoPalette.text.primary,
          border: `1px solid ${dittoPalette.semantic.successBorder}`,
        },
        standardWarning: {
          backgroundColor: dittoPalette.semantic.warningBg,
          color: dittoPalette.text.primary,
          border: `1px solid ${dittoPalette.semantic.warningBorder}`,
        },
        standardError: {
          backgroundColor: dittoPalette.semantic.errorBg,
          color: dittoPalette.text.primary,
          border: `1px solid ${dittoPalette.semantic.errorBorder}`,
        },
      },
    },
  },
});
