import { defineConfig, type Plugin } from "vite";

function stripCrossoriginPlugin(): Plugin {
  return {
    name: "strip-crossorigin",
    transformIndexHtml(html) {
      return html.replace(/\s+crossorigin(="[^"]*")?/g, "");
    },
  };
}

export default defineConfig({
  clearScreen: false,
  plugins: [stripCrossoriginPlugin()],
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
        hoistTransitiveImports: false,
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