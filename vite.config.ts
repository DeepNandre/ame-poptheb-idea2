import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig, type PluginOption } from "vite";
// @ts-expect-error — plain .mjs server module, no types
import { earlyAccessMiddleware } from "./server/earlyAccess.mjs";

// Mounts the /api/early-access lead-capture endpoint inside the Vite dev and
// preview servers so the early-access form works with `npm run dev` /
// `npm run preview`. (A static-only host has no Node server — see README.)
function earlyAccessPlugin(): PluginOption {
  return {
    name: "early-access-api",
    configureServer(server) {
      server.middlewares.use(earlyAccessMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(earlyAccessMiddleware);
    },
  };
}

export default defineConfig({
  plugins: [react(), earlyAccessPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
