import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      fileName: () => "index.js",
      formats: ["cjs"],
    },
    outDir: ".",
    emptyOutDir: false,
    rollupOptions: {
      external: ["siyuan"],
      output: {
        globals: { siyuan: "siyuan" },
      },
    },
    minify: false,
    sourcemap: false,
  },
});