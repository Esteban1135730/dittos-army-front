import type { DittoPalette } from "./ditto-palette";

declare module "@mui/material/styles" {
  interface Palette {
    ditto: DittoPalette;
  }
  interface PaletteOptions {
    ditto?: DittoPalette;
  }
}

export {};
