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

  // API Proxy Route for IFrames to bypass mixed content and X-Frame-Options
  app.get("/api/iframe-proxy", async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).send("URL is required");
    }

    try {
      const response = await axios.get(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
        responseType: "text",
      });

      let html = response.data;
      
      // Inject <base> tag to fix relative links (CSS, JS, Images)
      const baseUrl = new URL(targetUrl).origin;
      const baseTag = `<base href="${baseUrl}/">`;
      
      if (html.includes("<head>")) {
        html = html.replace("<head>", `<head>${baseTag}`);
      } else {
        html = `${baseTag}${html}`;
      }

      // Remove X-Frame-Options and other headers that might block embedding
      res.setHeader("Content-Type", "text/html");
      res.setHeader("X-Frame-Options", "ALLOWALL");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.send(html);
    } catch (error) {
      console.error("Proxy error:", error);
      res.status(500).send("Failed to fetch the target URL");
    }
  });

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
