import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Sudoku",
        short_name: "Sudoku",
        display: "standalone",
        background_color: "#e9eef5",
        theme_color: "#0e8a8c",
        icons: [
          // { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          // { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],
});
