import { defineConfig } from "vite";

export default defineConfig({
  clearScreen: false,
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
  build: {
    target: "es2022",
    minify: "esbuild",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes("node_modules/@tauri-apps/")) return "vendor";
          if (id.includes("node_modules/@codemirror/")) return "editor";
          if (id.includes("node_modules/i18next")) return "i18n";
          if (id.includes("node_modules/@oclushion/browser-protect")) return "sano";
          return undefined;
        },
      },
    },
  },
});