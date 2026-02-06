const express = require("express");
const rateLimit = require("express-rate-limit");
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting
app.use(rateLimit({ windowMs: 60 * 1000, max: 120 }));

// Serve static files from public
app.use(express.static("public"));

// Crash page
function crashPage(reason = "BlueNebula Error") {
  return `
  <html>
    <head><title>BlueNebula</title></head>
    <body style="background:#030a18;color:white;font-family:Arial;text-align:center;padding-top:60px;">
      <h1>BlueNebula Crash</h1>
      <p>${reason}</p>
    </body>
  </html>`;
}

// Blocked domains
const BLOCKED_DOMAINS = ["google.com", "youtube.com", "facebook.com", "twitter.com"];

// Check if target is blocked
function isBlocked(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return BLOCKED_DOMAINS.some(domain => hostname.endsWith(domain));
  } catch {
    return false;
  }
}

// Proxy route
app.get("/proxy", async (req, res) => {
  try {
    let target = req.query.url;

    // Handle about:blank
    if (!target || target === "about:blank") {
      return res.send(`<html><body style="background:#030a18;color:white;text-align:center;"><h1>Blank Page</h1></body></html>`);
    }

    // If not full URL → default to Bing search
    if (!target.startsWith("http")) {
      target = "https://www.bing.com/search?q=" + encodeURIComponent(target);
    }

    // Check blocked domains
    if (isBlocked(target)) {
      return res.send(crashPage("This site is blocked by BlueNebula."));
    }

    // Lazy fetch with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000); // 2 minutes

    try {
      const response = await fetch(target, { headers: { "User-Agent": "Mozilla/5.0" }, signal: controller.signal });
      clearTimeout(timeout);

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/html")) {
        res.set("Content-Type", contentType);
        return response.body.pipe(res);
      }

      // Return HTML as-is
      const html = await response.text();
      res.set("Content-Type", "text/html");
      return res.send(html);
    } catch (err) {
      console.warn("Primary fetch failed or timeout, switching to Fetch + Blob fallback:", err.message);

      // FETCH + BLOB fallback
      try {
        const fallbackResp = await fetch(target, { headers: { "User-Agent": "Mozilla/5.0" } });
        let html = await fallbackResp.text();

        // Inline CSS & JS by simple regex replacement
        html = html.replace(/<link rel="stylesheet" href="(.*?)"/g, (match, href) => {
          return `<style>@import url('${href}');</style>`;
        });
        html = html.replace(/<script src="(.*?)"/g, (match, src) => {
          return `<script src="${src}"></script>`;
        });

        res.set("Content-Type", "text/html");
        return res.send(html);
      } catch (fallbackErr) {
        console.error("Fallback fetch failed:", fallbackErr.message);
        return res.send(crashPage("Site unavailable or too heavy for BlueNebula."));
      }
    }
  } catch (outerErr) {
    console.error("Proxy route error:", outerErr.message);
    res.send(crashPage("Unexpected error in BlueNebula proxy."));
  }
});

// Health check
app.get("/health", (req, res) => res.send("BlueNebula Online"));

app.listen(PORT, () => console.log("BlueNebula running on port " + PORT));
