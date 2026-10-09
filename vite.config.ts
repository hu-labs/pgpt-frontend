/// <reference types="vitest/config" />

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
//import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  plugins: [
    react(),
    //visualizer({ open: true }), // visual chart
  ],
  base: "./",
  build: {
    sourcemap: true,
    outDir: "dist",
    emptyOutDir: true,
  },
  test: {
    environment: "jsdom",
    environmentOptions: {
      jsdom: {
        url: "http://localhost/",
      },
    },
    coverage: {
      provider: "v8",
    },
    setupFiles: ["./src/test/setup.ts"],
  },
});
