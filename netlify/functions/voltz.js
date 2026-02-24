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
        "User-Agent": "Mozilla/5.0",
        "Accept": "*/*"
      }
    });

    const contentType = response.headers.get("content-type") || "";
    const buffer = await response.arrayBuffer();

    // Handle HTML rewriting
    if (contentType.includes("text/html")) {
      let text = new TextDecoder().decode(buffer);

      text = text.replace(
        /<head>/i,
        `<head><base href="${targetUrl}">`
      );

      return {
        statusCode: response.status,
        headers: {
          "Content-Type": contentType
        },
        body: text
      };
    }

    // Handle other files (images, css, js)
    return {
      statusCode: response.status,
      headers: {
        "Content-Type": contentType
      },
      body: Buffer.from(buffer).toString("base64"),
      isBase64Encoded: true
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: "Proxy error: " + err.message
    };
  }
}
