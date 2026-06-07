import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type PluginOption } from "vite";
// @ts-expect-error — plain .mjs server module, no types
import { planningMiddleware } from "./server/planning.mjs";
// @ts-expect-error — plain .mjs server module, no types
import { attachScannerRelay, logOsintKeyStatus, SCANNER_WS_PATH } from "./server/scannerRelay.mjs";
// @ts-expect-error — plain .mjs server module, no types
import { cctvStreamMiddleware } from "./server/cctvStream.mjs";
// @ts-expect-error — plain .mjs server module, no types
import { agentMiddleware } from "./server/agent.mjs";
// @ts-expect-error — plain .mjs server module, no types
import { earlyAccessMiddleware } from "./server/earlyAccess.mjs";
// @ts-expect-error — plain .mjs server module, no types
import { buildingMiddleware } from "./server/building.mjs";

// Serves /api/planning/*, /api/cctv/*, /api/agent/*, /api/early-access and the
// scanner WebSocket relay in-process during `npm run dev`.
function backendPlugin(): PluginOption {
  return {
    name: "backend-api",
    configureServer(server) {
      server.middlewares.use(earlyAccessMiddleware);
      server.middlewares.use(buildingMiddleware);
      server.middlewares.use(planningMiddleware);
      server.middlewares.use(cctvStreamMiddleware);
      server.middlewares.use(agentMiddleware);
      logOsintKeyStatus();
      // Post hook — attach WebSocket only AFTER Vite successfully binds a port.
      // Attaching early causes an unhandled EADDRINUSE crash when 5173 is taken.
      return () => {
        attachScannerRelay(server.httpServer, { shareWithVite: true });
        const port = server.config.server.port;
        console.log(
          `[vite] Scanner WebSocket at ws://localhost:${port}${SCANNER_WS_PATH} (Vite HMR untouched)`,
        );
      };
    },
    configurePreviewServer(server) {
      server.middlewares.use(earlyAccessMiddleware);
      server.middlewares.use(buildingMiddleware);
      server.middlewares.use(planningMiddleware);
      server.middlewares.use(cctvStreamMiddleware);
      server.middlewares.use(agentMiddleware);
      return () => {
        attachScannerRelay(server.httpServer, { shareWithVite: true });
      };
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // The two Python apps in backend/. Override per-machine via .env:
  //   VITE_PIPELINE_API  blueprint pipeline (pipeline_app.py)  — default :8001
  //   VITE_SCAN_API      VPN-gated device scanner (api.py)     — default :8000
  // Frontend always calls the relative /api/pipeline/* and /api/scan/* prefixes;
  // these proxies strip the prefix and forward to the real app.
  const pipelineApi = env.VITE_PIPELINE_API || "http://localhost:8001";
  const scanApi = env.VITE_SCAN_API || "http://localhost:8000";
  const reconProxy = {
    "/api/pipeline": {
      target: pipelineApi,
      changeOrigin: true,
      rewrite: (p: string) => p.replace(/^\/api\/pipeline/, ""),
    },
    "/api/scan": {
      target: scanApi,
      changeOrigin: true,
      rewrite: (p: string) => p.replace(/^\/api\/scan/, ""),
    },
  };

  return {
  plugins: [react(), backendPlugin()],
  server: {
    // If 5173 is taken (old dev server), use 5174+ instead of crashing
    strictPort: false,
    proxy: reconProxy,
  },
  preview: {
    proxy: reconProxy,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Split heavy, rarely-changing vendor code into its own cacheable chunks so
    // the app shell stays small and mapbox-gl downloads in parallel.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/mapbox-gl")) return "mapbox";
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/scheduler/")
          ) {
            return "react";
          }
          return undefined;
        },
      },
    },
    // mapbox-gl (~1.8 MB) is an irreducible vendor floor in its own chunk; warn
    // only on chunks larger than that so genuine app-code regressions still flag.
    chunkSizeWarningLimit: 1900,
  },
  };
});
