const express = require("express");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(rateLimit({ windowMs: 60 * 1000, max: 120 }));
app.use(express.static("public"));

function crashPage(reason = "BlueNebula Overload") {
  return `
  <html>
  <head>
    <title>BlueNebula Crash</title>
    <style>
      body {
        margin:0;
        font-family:Arial;
        background:linear-gradient(135deg,#030a18,#0d1f3d);
        color:white;
        display:flex;
        align-items:center;
        justify-content:center;
        height:100vh;
        text-align:center;
      }
      h1 { font-size:48px; }
      p { opacity:0.8; }
    </style>
  </head>
  <body>
    <div>
      <h1>BlueNebula Crash</h1>
      <p>${reason}</p>
      <p>This site may be too heavy for the Render Free galaxy.</p>
    </div>
  </body>
  </html>
  `;
}

function isLikelyURL(input) {
  return input && (input.includes(".") || input.startsWith("http"));
}

app.get("/proxy", async (req, res) => {
  const start = Date.now();

  try {
    let target = req.query.url;

    // about:blank support
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

    if (!target.startsWith("http")) {
      target = "https://" + target;
    }

    // LAZY LOAD fetch only when needed
    const fetch = (await import("node-fetch")).default;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(target, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: controller.signal
    });

    clearTimeout(timeout);

    const contentType = response.headers.get("content-type") || "";

    // CPU safety guard
    if (Date.now() - start > 20000) {
      return res.send(crashPage("Request timeout."));
    }

    // HTML handling (cheerio only loads here if needed)
    if (contentType.includes("text/html")) {

      const cheerio = (await import("cheerio")).default;
      const html = await response.text();
      const $ = cheerio.load(html);

      // Remove CSP
      $("meta[http-equiv='Content-Security-Policy']").remove();

      // Rewrite anchors
      $("a").each((_, el) => {
        const href = $(el).attr("href");
        if (!href) return;
        try {
          const absolute = new URL(href, target).href;
          $(el).attr("href", "/proxy?url=" + encodeURIComponent(absolute));
        } catch {}
      });

      // Rewrite scripts
      $("script[src]").each((_, el) => {
        const src = $(el).attr("src");
        try {
          const absolute = new URL(src, target).href;
          $(el).attr("src", "/proxy?url=" + encodeURIComponent(absolute));
        } catch {}
      });

      // Rewrite stylesheets
      $("link[rel='stylesheet']").each((_, el) => {
        const href = $(el).attr("href");
        try {
          const absolute = new URL(href, target).href;
          $(el).attr("href", "/proxy?url=" + encodeURIComponent(absolute));
        } catch {}
      });

      // Inject fetch/XHR rewrite
      $("head").append(`
        <script>
          const f = window.fetch;
          window.fetch = function(r,c){
            if(typeof r==="string" && !r.startsWith("/proxy")){
              r="/proxy?url="+encodeURIComponent(r);
            }
            return f(r,c);
          };
          const o = XMLHttpRequest.prototype.open;
          XMLHttpRequest.prototype.open=function(m,u){
            if(!u.startsWith("/proxy")){
              u="/proxy?url="+encodeURIComponent(u);
            }
            return o.apply(this,[m,u]);
          };
        </script>
      `);

      res.set("Content-Type", "text/html");
      return res.send($.html());
    }

    // JS or CSS passthrough
    if (contentType.includes("javascript") || contentType.includes("css")) {
      const body = await response.text();
      res.set("Content-Type", contentType);
      return res.send(body);
    }

    // Stream everything else (images, fonts, media)
    res.set("Content-Type", contentType);
    response.body.pipe(res);

  } catch (err) {
    console.error("BlueNebula error:", err.message);
    res.send(crashPage("Heavy site detected or CPU overload."));
  }
});

app.get("/health", (req, res) => {
  res.send("BlueNebula Online");
});

app.listen(PORT, () => {
  console.log("BlueNebula running on port " + PORT);
});
