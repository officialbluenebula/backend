// functions/proxy.js
import fetch from "node-fetch";

export async function handler(event, context) {
  try {
    const targetUrl = event.queryStringParameters?.url;
    if (!targetUrl) {
      return {
        statusCode: 400,
        body: "Missing 'url' query parameter",
      };
    }

    // Fetch the target page
    const res = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                      "(KHTML, like Gecko) Chrome/114.0 Safari/537.36"
      }
    });

    let body = await res.text();

    // Optional: fix relative URLs so CSS/JS/images still work
    body = body.replace(/<head>/i, `<head><base href="${targetUrl}">`);

    // Return the HTML
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/html",
        "X-Frame-Options": "ALLOWALL", // allow iframe embedding
        "Content-Security-Policy": "frame-ancestors *", // allow any parent frame
      },
      body,
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: `Proxy error: ${err.message}`,
    };
  }
}
