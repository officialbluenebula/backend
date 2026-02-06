const express = require("express");
const rateLimit = require("express-rate-limit");
const cheerio = require("cheerio"); // only loads when needed inside route
const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting
app.use(rateLimit({ windowMs: 60 * 1000, max: 120 }));

// Serve static files from public folder
app.use(express.static("public"));

// Simple URL check
function isLikelyURL(input) {
  return input && (input.includes(".") || input.startsWith("http"));
}

// Crash page
function crashPage(reason = "BlueNebula Error") {
  return `
  <html>
    <head>
      <title>BlueNebula</title>
      <style>
        body {margin:0;font-family:Arial;background:linear-gradient(135deg,#030a18,#0d1f3d);color:white;display:flex;justify-content:center;align-items:center;height:100vh;text-align:center;}
        h1{font-size:48px;}p{opacity:0.8;}
      </style>
    </head>
    <body>
      <div><h1>BlueNebula Crash</h1><p>${reason}</p></div>
    </body>
  </html>
  `;
}

// Proxy route
app.get("/proxy", (req, res) => {

  (async () => {
    try {
      let target = req.query.url;

      // About blank
      if (!target || target === "about:blank") {
        return res.send(`
          <html>
            <body style="background:#030a18;color:white;font-family:Arial;text-align:center;padding-top:60px;">
              <h1>Blank Page</h1>
            </body>
          </html>
        `);
      }

      // Bing fallback
      if (!isLikelyURL(target)) {
        target = "https://www.bing.com/search?q=" + encodeURIComponent(target);
      }

      if (!target.startsWith("http")) target = "https://" + target;

      // LAZY FETCH only here
      const fetch = (await import("node-fetch")).default;

      const response = await fetch(target, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });

      const contentType = response.headers.get("content-type") || "";

      // Stream non-HTML directly
      if (!contentType.includes("text/html")) {
        res.set("Content-Type", contentType);
        return response.body.pipe(res);
      }

      // HTML processing
      const html = await response.text();
      const $ = cheerio.load(html);

      // Remove CSP
      $("meta[http-equiv='Content-Security-Policy']").remove();

      // Rewrite links
      $("a[href]").each((_, el) => {
        try {
          const href = $(el).attr("href");
          const absolute = new URL(href, target).href;
          $(el).attr("href", "/proxy?url=" + encodeURIComponent(absolute));
        } catch {}
      });

      // Rewrite scripts
      $("script[src]").each((_, el) => {
        try {
          const src = $(el).attr("src");
          const absolute = new URL(src, target).href;
          $(el).attr("src", "/proxy?url=" + encodeURIComponent(absolute));
        } catch {}
      });

      // Rewrite stylesheets
      $("link[rel='stylesheet']").each((_, el) => {
        try {
          const href = $(el).attr("href");
          const absolute = new URL(href, target).href;
          $(el).attr("href", "/proxy?url=" + encodeURIComponent(absolute));
        } catch {}
      });

      res.set("Content-Type", "text/html");
      res.send($.html());

    } catch (err) {
      console.error("Proxy error:", err.message);
      res.send(crashPage("Site unavailable or too heavy."));
    }
  })();

});

// Health route
app.get("/health", (req, res) => res.send("BlueNebula Online"));

app.listen(PORT, () => {
  console.log("BlueNebula running on port " + PORT);
});
