const express = require("express");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 3000;

/*
  Light rate limiting
  Keeps Render from melting if friends spam refresh
*/
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 80
});

app.use(limiter);
app.use(express.static("public"));

/*
  Utility: detect if input looks like a real URL
*/
function isLikelyURL(input) {
  return input.includes(".") || input.startsWith("http");
}

/*
  Lazy loader for heavy modules
  Only loads fetch + cheerio when proxy route is actually used
*/
let fetchModule = null;
let cheerioModule = null;

async function getModules() {
  if (!fetchModule) {
    fetchModule = require("node-fetch");
  }
  if (!cheerioModule) {
    cheerioModule = require("cheerio");
  }
  return {
    fetch: fetchModule,
    cheerio: cheerioModule
  };
}

/*
  Proxy route
*/
app.get("/proxy", async (req, res) => {
  try {
    let target = req.query.url;
    if (!target) return res.status(400).send("No input provided.");

    // If not a URL, redirect to Bing search
    if (!isLikelyURL(target)) {
      target = "https://www.bing.com/search?q=" + encodeURIComponent(target);
    }

    // Add https if missing
    if (!target.startsWith("http")) {
      target = "https://" + target;
    }

    const { fetch, cheerio } = await getModules();

    const response = await fetch(target, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    const body = await response.text();
    const $ = cheerio.load(body);

    // Rewrite anchor links
    $("a").each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;

      if (href.startsWith("http")) {
        $(el).attr("href", "/proxy?url=" + encodeURIComponent(href));
      } else if (href.startsWith("/")) {
        const origin = new URL(target).origin;
        $(el).attr("href", "/proxy?url=" + encodeURIComponent(origin + href));
      }
    });

    // Rewrite forms
    $("form").each((_, el) => {
      const action = $(el).attr("action");
      if (!action) return;

      if (action.startsWith("http")) {
        $(el).attr("action", "/proxy?url=" + encodeURIComponent(action));
      }
    });

    res.send($.html());

  } catch (err) {
    console.error(err);
    res.status(500).send("BlueNebula encountered turbulence.");
  }
});

/*
  Health check route (helps Render stay calm)
*/
app.get("/health", (req, res) => {
  res.send("BlueNebula online.");
});

app.listen(PORT, () => {
  console.log(`BlueNebula Gateway running on port ${PORT}`);
});
