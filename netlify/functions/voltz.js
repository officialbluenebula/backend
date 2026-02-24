export async function handler(event) {
  try {
    const targetUrl = event.queryStringParameters?.url;

    if (!targetUrl) {
      return {
        statusCode: 400,
        body: "Missing url parameter"
      };
    }

    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Voltz Public Server)"
      }
    });

    let html = await response.text();

    // Inject base tag so relative CSS/JS loads correctly
    html = html.replace(/<head>/i, `<head><base href="${targetUrl}">`);

    // 5 Second Forced Ad Overlay
    const adOverlay = `
      <div id="voltz-ad" style="
        position:fixed;
        inset:0;
        background:linear-gradient(135deg,#020817,#0b1e3a);
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        z-index:9999999;
        color:white;
        font-family:Arial;
      ">
        <img src="https://ik.imagekit.io/l7uslhlci/IMG_3858.jpeg"
             style="max-width:320px;border-radius:16px;box-shadow:0 0 40px rgba(0,0,0,.5);">
        <h2 style="margin-top:20px;">Voltz Public Server</h2>
        <p>This server is loading your page…</p>
        <p>Starting in 5 seconds</p>
      </div>

      <script>
        setTimeout(() => {
          const ad = document.getElementById("voltz-ad");
          if (ad) ad.remove();
        }, 5000);
      </script>
    `;

    // Inject after <body>
    html = html.replace(/<body[^>]*>/i, match => match + adOverlay);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/html",
        "Access-Control-Allow-Origin": "*"
      },
      body: html
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: "Voltz Server Error: " + err.message
    };
  }
}
