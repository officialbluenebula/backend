export async function handler(event) {
  try {
    const targetUrl = event.queryStringParameters?.url;
    if (!targetUrl) {
      return { statusCode: 400, body: "Missing url parameter" };
    }

    // Fetch target site with browser-like headers
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });

    let body = await response.text();

    // Inject <base> so relative links work
    body = body.replace(/<head>/i, `<head><base href="${targetUrl}">`);

    // Voltz Public Server 5-second ad overlay
    const adImageUrl = "https://ik.imagekit.io/l7uslhlci/IMG_3858.jpeg";

    const adOverlay = `
      <div id="voltz-ad-overlay" style="
        position:fixed;top:0;left:0;width:100%;height:100%;
        background:#000;display:flex;justify-content:center;
        align-items:center;z-index:9999;">
        <img src="${adImageUrl}" style="max-width:80%;max-height:80%;">
      </div>
      <script>
        setTimeout(() => {
          const overlay = document.getElementById('voltz-ad-overlay');
          if (overlay) overlay.remove();
        }, 5000);
      </script>
    `;

    // Inject overlay after <body>
    body = body.replace(/<body[^>]*>/i, match => match + adOverlay);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/html",
        "X-Frame-Options": "ALLOWALL",
        "Content-Security-Policy": "frame-ancestors *"
      },
      body
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: "Voltz Public Server Error: " + error.message
    };
  }
}
