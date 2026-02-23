import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";
import path from "node:path";
import { visualizer } from "rollup-plugin-visualizer";

import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";

export default defineConfig({
  plugins: [
    react(),
    dts({
      insertTypesEntry: true,
      include: ["src"],
      exclude: ["**/*.test.*", "**/*.spec.*", "**/*.stories.*"],
    }),
    visualizer({ filename: "stats.html", gzipSize: true, brotliSize: true }),
    cssInjectedByJsPlugin(),
  ],
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      formats: ["es", "cjs"],
      fileName: (format) => (format === "es" ? "index.mjs" : "index.cjs"),
    },
    sourcemap: false,
    rollupOptions: {
      external: (id) => {
        const pkgs = ["react", "react-dom", "three", "@react-three/fiber"];
        return pkgs.some((p) => id === p || id.startsWith(p + "/"));
      },
      output: { exports: "named" },
    },
  },
});
