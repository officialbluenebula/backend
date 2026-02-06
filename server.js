const express = require("express");
const rateLimit = require("express-rate-limit");
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args)); // lazy import
const app = express();
const PORT = process.env.PORT || 3000;

app.use(rateLimit({ windowMs: 60*1000, max: 120 }));
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

// Simple URL validation
function isLikelyURL(input) {
  return input && (input.includes(".") || input.startsWith("http"));
}

// Proxy route
app.get("/proxy", async (req, res) => {
  try {
    let target = req.query.url;

    // about:blank
    if (!target || target === "about:blank") {
      return res.send(`<html><body style="background:#030a18;color:white;text-align:center;"><h1>Blank Page</h1></body></html>`);
    }

    // Force full URL
    if (!target.startsWith("http")) {
      if (!isLikelyURL(target)) {
        target = "https://www.bing.com/search?q=" + encodeURIComponent(target);
      } else {
        target = "https://" + target;
      }
    }

    // Lazy fetch
    const response = await fetch(target, { headers: { "User-Agent": "Mozilla/5.0" } });

    // Stream non-HTML (images, files)
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      res.set("Content-Type", contentType);
      return response.body.pipe(res);
    }

    // Return HTML as-is (no rewriting) — this makes Bing and modern sites work
    const html = await response.text();
    res.set("Content-Type", "text/html");
    res.send(html);

  } catch (err) {
    console.error("Proxy error:", err.message);
    res.send(crashPage("Site unavailable or too heavy."));
  }
});

app.get("/health", (req, res) => res.send("BlueNebula Online"));

app.listen(PORT, () => console.log("BlueNebula running on port " + PORT));
