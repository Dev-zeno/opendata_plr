import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Mount API proxies for local development
  app.get("/api/proxy-info", require("./api/proxy-info.js"));
  app.get("/api/proxy-reading-room", require("./api/proxy-reading-room.js"));
  app.get("/api/seat-map-proxy", require("./api/seat-map-proxy.js"));
  app.get("/api/collect-data", require("./api/collect-data.js"));
  app.get("/api/get-stats", require("./api/get-stats.js"));
  app.get("/api/iframe-proxy", require("./api/iframe-proxy.js"));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
