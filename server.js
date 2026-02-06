const express = require("express");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(rateLimit({ windowMs: 60 * 1000, max: 120 }));
app.use(express.static("public"));

function isLikelyURL(input) {
  return input && (input.includes(".") || input.startsWith("http"));
}

app.get("/proxy", async (req, res) => {
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

    // Lazy load fetch
    const fetch = (await import("node-fetch")).default;

    const response = await fetch(target, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    const contentType = response.headers.get("content-type") || "";

    // If NOT HTML, stream it directly
    if (!contentType.includes("text/html")) {
      res.set("Content-Type", contentType);
      return response.body.pipe(res);
    }

    // Lazy load cheerio only for HTML
    const cheerio = (await import("cheerio")).default;
    const html = await response.text();
    const $ = cheerio.load(html);

    // Basic rewriting only
    $("a[href]").each((_, el) => {
      try {
        const href = $(el).attr("href");
        const absolute = new URL(href, target).href;
        $(el).attr("href", "/proxy?url=" + encodeURIComponent(absolute));
      } catch {}
    });

    $("link[rel='stylesheet']").each((_, el) => {
      try {
        const href = $(el).attr("href");
        const absolute = new URL(href, target).href;
        $(el).attr("href", "/proxy?url=" + encodeURIComponent(absolute));
      } catch {}
    });

    $("script[src]").each((_, el) => {
      try {
        const src = $(el).attr("src");
        const absolute = new URL(src, target).href;
        $(el).attr("src", "/proxy?url=" + encodeURIComponent(absolute));
      } catch {}
    });

    res.set("Content-Type", "text/html");
    res.send($.html());

  } catch (err) {
    console.error("Proxy error:", err.message);
    res.status(500).send("BlueNebula Error: Site unavailable or too heavy.");
  }
});

app.get("/health", (req, res) => {
  res.send("BlueNebula Online");
});

app.listen(PORT, () => {
  console.log("BlueNebula running on port " + PORT);
});
