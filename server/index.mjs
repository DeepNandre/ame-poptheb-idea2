// Standalone planning proxy + WebSocket scanner relay
// Run with: npm run api  (or use npm run dev — Vite mounts the same relay in-process)
import http from "node:http";
import { planningMiddleware } from "./planning.mjs";
import { attachScannerRelay, logOsintKeyStatus, SCANNER_WS_PATH } from "./scannerRelay.mjs";
import { cctvStreamMiddleware } from "./cctvStream.mjs";
import { agentMiddleware } from "./agent.mjs";
import { earlyAccessMiddleware } from "./earlyAccess.mjs";
import { buildingMiddleware } from "./building.mjs";
import { staticMiddleware, hasStaticBuild } from "./static.mjs";

const PORT = Number(process.env.PLANNING_PORT || 8787);

const server = http.createServer((req, res) => {
  earlyAccessMiddleware(req, res, () => {
    buildingMiddleware(req, res, () => {
      cctvStreamMiddleware(req, res, () => {
        agentMiddleware(req, res, () => {
          planningMiddleware(req, res, () => {
            staticMiddleware(req, res, () => {
              res.statusCode = 404;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "Not found" }));
            });
          });
        });
      });
    });
  });
});

attachScannerRelay(server);

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`WebSocket scanner available at ws://localhost:${PORT}${SCANNER_WS_PATH}`);
  console.log(
    hasStaticBuild()
      ? `Serving production build from dist/ — open http://localhost:${PORT}`
      : `No dist/ build found — run 'npm run build' to serve the app from this port`,
  );
  logOsintKeyStatus();
});
