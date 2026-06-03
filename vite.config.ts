import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), basicSsl()],
  resolve: {
    // Evita dos copias de @zxing/library (rompe `instanceof NotFoundException` en el bucle de escaneo).
    dedupe: ["@zxing/library"],
  },
  optimizeDeps: {
    include: ["recharts"],
  },
  server: {
    host: true,
    // API Nest por HTTP en el PC; el navegador (móvil) solo habla HTTPS con Vite.
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
