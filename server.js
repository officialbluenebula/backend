const express = require("express");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiter
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 80
});

app.use(limiter);
app.use(express.static("public"));

// Lazy-load modules
let fetchModule = null;
let cheerioModule = null;

async function getModules() {
  if (!fetchModule) fetchModule = require("node-fetch");
  if (!cheerioModule) cheerioModule = require("cheerio");
  return { fetch: fetchModule, cheerio: cheerioModule };
}

// Detect if input is a URL
function isLikelyURL(input) {
  return input.includes(".") || input.startsWith("http");
}

// Proxy route
app.get("/proxy", async (req, res) => {
  try {
    let target = req.query.url;
    if (!target) return res.status(400).send("No input provided.");

    // Redirect non-URLs to Bing search
    if (!isLikelyURL(target)) {
      target = "https://www.bing.com/search?q=" + encodeURIComponent(target);
    }
    if (!target.startsWith("http")) {
      target = "https://" + target;
    }

    const { fetch, cheerio } = await getModules();

    const response = await fetch(target, { headers: { "User-Agent": "Mozilla/5.0" } });

    // Get content type
    const contentType = response.headers.get("content-type");

    if (!contentType) return res.status(500).send("No content type.");

    if (contentType.includes("text/html")) {
      let body = await response.text();
      const $ = cheerio.load(body);

      // Rewrite links
      $("a").each((_, el) => {
        const href = $(el).attr("href");
        if (!href) return;
        let absolute = href.startsWith("http") ? href : new URL(href, target).href;
        $(el).attr("href", "/proxy?url=" + encodeURIComponent(absolute));
      });

      // Rewrite forms
      $("form").each((_, el) => {
        const action = $(el).attr("action");
        if (!action) return;
        let absolute = action.startsWith("http") ? action : new URL(action, target).href;
        $(el).attr("action", "/proxy?url=" + encodeURIComponent(absolute));
      });

      // Rewrite JS & CSS
      $("link[rel='stylesheet']").each((_, el) => {
        const href = $(el).attr("href");
        if (!href) return;
        let absolute = href.startsWith("http") ? href : new URL(href, target).href;
        $(el).attr("href", "/proxy?url=" + encodeURIComponent(absolute));
      });

      $("script").each((_, el) => {
        const src = $(el).attr("src");
        if (!src) return;
        let absolute = src.startsWith("http") ? src : new URL(src, target).href;
        $(el).attr("src", "/proxy?url=" + encodeURIComponent(absolute));
      });

      res.set("Content-Type", "text/html");
      res.send($.html());

    } else if (
      contentType.includes("text/css") ||
      contentType.includes("application/javascript") ||
      contentType.includes("text/javascript")
    ) {
      // Fetch CSS or JS files and send as-is
      const body = await response.text();
      res.set("Content-Type", contentType);
      res.send(body);
    } else {
      // For images, videos, fonts, etc., pipe directly
      const buffer = await response.buffer();
      res.set("Content-Type", contentType);
      res.send(buffer);
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("BlueNebula encountered turbulence.");
  }
});

// Health check
app.get("/health", (req, res) => res.send("BlueNebula online."));

app.listen(PORT, () => {
  console.log(`BlueNebula Gateway running on port ${PORT}`);
});
