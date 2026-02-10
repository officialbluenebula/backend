export async function handler(event) {
  try {
    const targetUrl = event.queryStringParameters?.url;
    if (!targetUrl) {
      return { statusCode: 400, body: "Missing url parameter" };
    }

    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    let body = await response.text();

    body = body.replace(/<head>/i, `<head><base href="${targetUrl}">`);

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
      body: "Proxy error: " + error.message
    };
  }
}
