const express = require("express");
const rateLimit = require("express-rate-limit");
const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(rateLimit({ windowMs: 60 * 1000, max: 120 }));
app.use(express.static("public"));

// Blocked domains
const BLOCKED_DOMAINS = ["google.com", "youtube.com", "facebook.com", "twitter.com"];

// Utility crash pages
function crashPage(message) {
  return `
    <html>
      <head><title>BlueNebula</title></head>
      <body style="background:#030a18;color:white;font-family:Arial;text-align:center;padding-top:60px;">
        <h1>${message}</h1>
      </body>
    </html>
  `;
}

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
  let target = req.query.url;

  // About:blank
  if (!target || target === "about:blank") {
    return res.send(`<html><body style="background:#030a18;color:white;text-align:center;"><h1>Blank Page</h1></body></html>`);
  }

  // Not full URL → Bing search
  if (!target.startsWith("http")) {
    target = "https://www.bing.com/search?q=" + encodeURIComponent(target);
  }

  // Blocked sites
  if (isBlocked(target)) {
    return res.send(crashPage("This site is blocked by BlueNebula."));
  }

  // Lazy fetch functions
  const lazyFetchPrimary = async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000); // 45s

    try {
      const response = await fetch(target, { headers: { "User-Agent": "Mozilla/5.0" }, signal: controller.signal });
      clearTimeout(timeout);

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/html")) {
        res.set("Content-Type", contentType);
        return response.body.pipe(res);
      }

      const html = await response.text();
      res.set("Content-Type", "text/html");
      res.send(html);
      return true;
    } catch {
      return false;
    }
  };

  const lazyFetchFallback = async () => {
    try {
      const fallbackResp = await fetch(target, { headers: { "User-Agent": "Mozilla/5.0" } });
      let html = await fallbackResp.text();

      // Inline CSS & JS minimally
      html = html.replace(/<link rel="stylesheet" href="(.*?)"/g, (match, href) => `<style>@import url('${href}');</style>`);
      html = html.replace(/<script src="(.*?)"/g, (match, src) => `<script src="${src}"></script>`);

      res.set("Content-Type", "text/html");
      res.send(html);
      return true;
    } catch {
      return false;
    }
  };

  // Step 1: Try primary
  const primarySuccess = await lazyFetchPrimary();
  if (primarySuccess) return;

  // Step 2: Primary failed or timed out → send switching message
  res.write(crashPage("The BlueNebula server didn’t respond, switching over to the Voltz servers"));
  res.flushHeaders();

  // Small delay so message appears
  await new Promise(r => setTimeout(r, 1000));

  // Step 3: Fallback
  const fallbackSuccess = await lazyFetchFallback();
  if (fallbackSuccess) return;

  // Step 4: Fallback failed → show message
  res.send(crashPage("The Voltz servers failed please try again soon"));
});

// Health check
app.get("/health", (req, res) => res.send("BlueNebula Online"));

app.listen(PORT, () => console.log("BlueNebula running on port " + PORT));
