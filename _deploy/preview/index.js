/* Chatora — single entrypoint serving the public site from Supabase Storage.
   This adapter is intentionally read-only and serves only approved public paths. */
const BASE = "https://sytogavpspwgjadorprn.supabase.co/storage/v1/object/public/site/";

const TYPES = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  jsonld: "application/ld+json; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  svg: "image/svg+xml",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  ico: "image/x-icon",
  woff2: "font/woff2",
  woff: "font/woff"
};

const PRIVATE_PREFIXES = ["_pages", "_partials", "_tools", "_deploy", "docs", "supabase"];

function securityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
}

async function grab(path) {
  const r = await fetch(BASE + path, { headers: { "user-agent": "chatora-site/1.2" } });
  return r.ok ? Buffer.from(await r.arrayBuffer()) : null;
}

module.exports = async (req, res) => {
  securityHeaders(res);
  const method = String(req.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    res.setHeader("Cache-Control", "no-store");
    res.statusCode = 405;
    res.end("Method not allowed");
    return;
  }
  const headOnly = method === "HEAD";

  let decoded;
  try {
    const requestUrl = new URL(req.url || "/", "https://preview.invalid");
    decoded = decodeURIComponent(requestUrl.pathname || "/");
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    res.statusCode = 400;
    res.end(headOnly ? undefined : "Bad request");
    return;
  }

  const p = decoded.replace(/^\/+/, "");
  const segments = p.split("/").filter(Boolean);
  if (p.includes("\\") || p.includes("\0") || segments.some((part) => part === "." || part === ".." || part.startsWith("."))) {
    res.setHeader("Cache-Control", "no-store");
    res.statusCode = 400;
    res.end(headOnly ? undefined : "Bad request");
    return;
  }
  if (segments.length && PRIVATE_PREFIXES.includes(segments[0].toLowerCase())) {
    res.setHeader("Cache-Control", "no-store");
    res.statusCode = 404;
    res.end(headOnly ? undefined : "Not found");
    return;
  }

  /* "/" and "/pricing/" -> index; "/pricing" -> pricing.html; "/ar" -> ar/index.html */
  let candidates;
  if (!p || decoded.endsWith("/")) candidates = [p + "index.html"];
  else if (/\.[a-z0-9]+$/i.test(p)) candidates = [p];
  else candidates = [p + ".html", p + "/index.html"];

  try {
    let hit = null;
    for (const candidate of candidates) {
      const body = await grab(candidate);
      if (body) { hit = { path: candidate, body }; break; }
    }
    if (hit) {
      const ext = hit.path.split(".").pop().toLowerCase();
      res.setHeader("Content-Type", TYPES[ext] || "application/octet-stream");
      res.setHeader(
        "Cache-Control",
        ext === "html" ? "public, max-age=0, must-revalidate" : "public, max-age=86400"
      );
      res.statusCode = 200;
      res.end(headOnly ? undefined : hit.body);
      return;
    }

    const notFound = await grab("404.html");
    res.setHeader("Content-Type", TYPES.html);
    res.setHeader("Cache-Control", "no-store");
    res.statusCode = 404;
    res.end(headOnly ? undefined : (notFound || Buffer.from("Not found")));
  } catch (err) {
    res.setHeader("Content-Type", TYPES.txt);
    res.setHeader("Cache-Control", "no-store");
    res.statusCode = 502;
    res.end(headOnly ? undefined : "Site content is temporarily unavailable.");
  }
};
