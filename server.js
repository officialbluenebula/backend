const express = require("express");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(rateLimit({ windowMs: 60 * 1000, max: 150 }));
app.use(express.static("public"));

function crashPage(reason = "BlueNebula Error") {
  return `
  <html>
    <head>
      <title>BlueNebula Error</title>
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
      </style>
    </head>
    <body>
      <div>
        <h1>BlueNebula</h1>
        <p>${reason}</p>
      </div>
    </body>
  </html>
  `;
}

function isLikelyURL(input) {
  return input && (input.includes(".") || input.startsWith("http"));
}

app.get("/proxy", async (req, res) => {
  try {
    let target = req.query.url;

    if (!target || target === "about:blank") {
      return res.send(`
        <html>
          <body style="background:#030a18;color:white;font-family:Arial;text-align:center;padding-top:60px;">
            <h1>Blank Page</h1>
          </body>
        </html>
      `);
    }

    if (!isLikelyURL(target)) {
      target = "https://www.bing.com/search?q=" + encodeURIComponent(target);
    }

    if (!target.startsWith("http")) {
      target = "https://" + target;
    }

    // Lazy load fetch
    const fetch = (await import("node-fetch")).default;

    const response = await fetch(target, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    const contentType = response.headers.get("content-type") || "";

    // Stream non-HTML immediately
    if (!contentType.includes("text/html")) {
      res.set("Content-Type", contentType);
      return response.body.pipe(res);
    }

    // Lazy load cheerio only for HTML
    const cheerio = (await import("cheerio")).default;
    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove CSP to allow scripts
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

    // Rewrite styles
    $("link[rel='stylesheet']").each((_, el) => {
      try {
        const href = $(el).attr("href");
        const absolute = new URL(href, target).href;
        $(el).attr("href", "/proxy?url=" + encodeURIComponent(absolute));
      } catch {}
    });

    // Inject lightweight fetch rewrite
    $("head").append(`
      <script>
        const originalFetch = window.fetch;
        window.fetch = function(resource, config) {
          if (typeof resource === "string" && !resource.startsWith("/proxy")) {
            resource = "/proxy?url=" + encodeURIComponent(resource);
          }
          return originalFetch(resource, config);
        };
      </script>
    `);

    res.set("Content-Type", "text/html");
    res.send($.html());

  } catch (err) {
    console.error("Proxy error:", err.message);
    res.send(crashPage("The requested site may be too heavy or unreachable."));
  }
});

app.get("/health", (req, res) => {
  res.send("BlueNebula Online");
});

app.listen(PORT, () => {
  console.log("BlueNebula running on port " + PORT);
});
