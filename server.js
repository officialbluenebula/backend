const express = require("express");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiter
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 80
});
app.use(limiter);

// Allow CORS for local files, about:blank, and any origin
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); // allow all origins
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

app.use(express.static("public"));

// Lazy-load modules
let fetchModule = null;
let cheerioModule = null;
async function getModules() {
  if (!fetchModule) fetchModule = require("node-fetch");
  if (!cheerioModule) cheerioModule = require("cheerio");
  return { fetch: fetchModule, cheerio: cheerioModule };
}

// Check if string is likely a URL
function isLikelyURL(input) {
  return input && (input.includes(".") || input.startsWith("http"));
}

// Proxy route
app.get("/proxy", async (req, res) => {
  try {
    let target = req.query.url;

    // Handle about:blank or empty requests
    if (!target || target === "about:blank") {
      return res.send(`
        <html>
          <body style="background:#030a18;color:white;font-family:Arial;text-align:center;padding-top:50px;">
            <h1>Blank Page</h1>
          </body>
        </html>
      `);
    }

    // Redirect non-URLs to Bing search
    if (!isLikelyURL(target)) {
      target = "https://www.bing.com/search?q=" + encodeURIComponent(target);
    }

    // Ensure proper scheme
    if (!target.startsWith("http")) target = "https://" + target;

    const { fetch, cheerio } = await getModules();
    const response = await fetch(target, { headers: { "User-Agent": "Mozilla/5.0" } });

    const contentType = response.headers.get("content-type") || "";

    // HTML pages
    if (contentType.includes("text/html")) {
      let body = await response.text();
      const $ = cheerio.load(body);

      // Rewrite links
      $("a").each((_, el) => {
        const href = $(el).attr("href");
        if (!href) return;
        const absolute = href.startsWith("http") ? href : new URL(href, target).href;
        $(el).attr("href", "/proxy?url=" + encodeURIComponent(absolute));
      });

      // Rewrite forms
      $("form").each((_, el) => {
        const action = $(el).attr("action");
        if (!action) return;
        const absolute = action.startsWith("http") ? action : new URL(action, target).href;
        $(el).attr("action", "/proxy?url=" + encodeURIComponent(absolute));
      });

      // Rewrite CSS links
      $("link[rel='stylesheet']").each((_, el) => {
        const href = $(el).attr("href");
        if (!href) return;
        const absolute = href.startsWith("http") ? href : new URL(href, target).href;
        $(el).attr("href", "/proxy?url=" + encodeURIComponent(absolute));
      });

      // Rewrite JS scripts
      $("script").each((_, el) => {
        const src = $(el).attr("src");
        if (!src) return;
        const absolute = src.startsWith("http") ? src : new URL(src, target).href;
        $(el).attr("src", "/proxy?url=" + encodeURIComponent(absolute));
      });

      res.set("Content-Type", "text/html");
      return res.send($.html());

    // File requests: CSS, JS, images, videos, fonts
    } else if (
      contentType.includes("text/css") ||
      contentType.includes("application/javascript") ||
      contentType.includes("text/javascript") ||
      contentType.includes("image/") ||
      contentType.includes("video/") ||
      contentType.includes("font/") ||
      contentType.includes("application/octet-stream")
    ) {
      const buffer = await response.buffer();
      res.set("Content-Type", contentType);
      return res.send(buffer);

    // Fallback
    } else {
      const buffer = await response.buffer();
      res.set("Content-Type", contentType || "application/octet-stream");
      return res.send(buffer);
    }

  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).send("BlueNebula encountered turbulence.");
  }
});

// Health check
app.get("/health", (req, res) => res.send("BlueNebula online."));

app.listen(PORT, () => {
  console.log(`BlueNebula Gateway running on port ${PORT}`);
});
