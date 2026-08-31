import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "fs";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { VitePWA } from "vite-plugin-pwa";

const useLocalHttps =
  fs.existsSync("localhost-key.pem") && fs.existsSync("localhost.pem");

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    nodePolyfills({
      include: ["buffer", "process"],
      globals: {
        Buffer: true,
        process: true,
      },
    }),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      registerType: "autoUpdate",
      injectManifest: {
        maximumFileSizeToCacheInBytes: 10000000,
      },
    }),
  ],

  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@clerk")) return "clerk";
          if (
            id.includes("recharts") ||
            id.includes("chart.js") ||
            id.includes("react-chartjs-2")
          ) {
            return "charts";
          }
          if (id.includes("d3")) return "d3";
          if (id.includes("react-force-graph") || id.includes("force-graph")) {
            return "force-graph";
          }
          if (
            id.includes("@tiptap") ||
            id.includes("/yjs") ||
            id.includes("\\yjs") ||
            id.includes("y-prosemirror") ||
            id.includes("y-protocols") ||
            id.includes("y-websocket")
          ) {
            return "collab";
          }
          if (id.includes("simple-peer")) return "webrtc";
          if (
            id.includes("react-markdown") ||
            id.includes("remark-gfm") ||
            id.includes("micromark")
          ) {
            return "markdown";
          }
        },
      },
    },
  },

  server: {
    https: useLocalHttps
      ? {
          key: fs.readFileSync("localhost-key.pem"),
          cert: fs.readFileSync("localhost.pem"),
        }
      : false,
    port: 5173,
    watch: {
      usePolling: true,
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/setupTests.js",
    testTimeout: 20000,
    pool: "threads",
  },
});
