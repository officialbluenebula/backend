const express = require("express");
const rateLimit = require("express-rate-limit");
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args)); // lazy import
const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting
app.use(rateLimit({ windowMs: 60*1000, max: 120 }));

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
const BLOCKED_DOMAINS = [
  "google.com",
  "youtube.com",
  "facebook.com",
  "twitter.com",
  // Add more heavy sites you want to block
];

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

    // about:blank
    if (!target || target === "about:blank") {
      return res.send(`<html><body style="background:#030a18;color:white;text-align:center;"><h1>Blank Page</h1></body></html>`);
    }

    // If user inputs something not a URL, treat as Bing search
    if (!target.startsWith("http")) {
      target = "https://www.bing.com/search?q=" + encodeURIComponent(target);
    }

    // Check blocked sites
    if (isBlocked(target)) {
      return res.send(crashPage("This site is blocked by BlueNebula."));
    }

    // Lazy fetch
    const response = await fetch(target, { headers: { "User-Agent": "Mozilla/5.0" } });

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      res.set("Content-Type", contentType);
      return response.body.pipe(res);
    }

    // Return HTML as-is, no rewriting
    const html = await response.text();
    res.set("Content-Type", "text/html");
    res.send(html);

  } catch (err) {
    console.error("Proxy error:", err.message);
    res.send(crashPage("Site unavailable or too heavy."));
  }
});

// Health check
app.get("/health", (req, res) => res.send("BlueNebula Online"));

app.listen(PORT, () => console.log("BlueNebula running on port " + PORT));
