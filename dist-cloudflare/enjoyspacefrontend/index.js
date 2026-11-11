const requestHeaderNames = [
  "accept",
  "accept-language",
  "content-type",
  "cookie",
  "origin",
  "referer",
  "x-csrf-token",
  "x-requested-with"
];
function protectApiResponse(response) {
  response.headers.set("Cache-Control", "no-store, private");
  response.headers.set("CDN-Cache-Control", "no-store");
  response.headers.set("Cloudflare-CDN-Cache-Control", "no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Content-Security-Policy", "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Strict-Transport-Security", "max-age=15552000");
  response.headers.delete("Server");
  response.headers.delete("X-Powered-By");
  return response;
}
function apiError(status, message) {
  return protectApiResponse(new Response(JSON.stringify({ message }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  }));
}
function backendOrigin(value, portalOrigin) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash || !hostname.includes(".") || /^[\d.]+$/.test(hostname) || hostname.includes(":") || hostname.endsWith(".localhost") || hostname.endsWith(".local") || url.origin === portalOrigin) return null;
    return url.origin;
  } catch {
    return null;
  }
}
async function handleRequest(request, env, fetchUpstream = fetch) {
  const incoming = new URL(request.url);
  const isApi = /^\/api(?:\/|$)/i.test(incoming.pathname);
  if (!isApi) return env.ASSETS.fetch(request);
  if (!/^\/api\/portal(?:\/[A-Za-z0-9_-]+)*\/?$/.test(incoming.pathname)) {
    return apiError(404, "找不到此服務，請重新整理頁面後再試。");
  }
  if (!["GET", "HEAD", "POST"].includes(request.method)) {
    const response = apiError(405, "此服務不支援這個操作方式，請重新整理頁面後再試。");
    response.headers.set("Allow", "GET, HEAD, POST");
    return response;
  }
  const origin = backendOrigin(env.API_ORIGIN, incoming.origin);
  if (!origin) return apiError(503, "網站服務尚未完成設定，請稍後再試。");
  const target = new URL(origin);
  target.pathname = incoming.pathname;
  target.search = incoming.search;
  const headers = new Headers();
  for (const name of requestHeaderNames) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  headers.set("Cache-Control", "no-store");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12e3);
  try {
    const upstream = await fetchUpstream(target.href, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? void 0 : request.body,
      duplex: "half",
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
      cf: { cacheEverything: false, cacheTtlByStatus: { "100-599": -1 } }
    });
    if (upstream.status >= 300 && upstream.status < 400 || upstream.status >= 500) {
      await upstream.body?.cancel();
      return apiError(502, "目前無法連線至工作室服務，請稍後再試。");
    }
    const contentType = upstream.headers.get("Content-Type") || "";
    const hasBody = request.method !== "HEAD" && upstream.status !== 204;
    if (hasBody && !/^application\/(?:json|[a-z0-9!#$&^_.+-]+\+json)(?:\s*;|\s*$)/i.test(contentType)) {
      await upstream.body?.cancel();
      if (upstream.status >= 400 && upstream.status < 500) {
        const messages = {
          400: "表單驗證失敗或頁面已過期，請確認資料後再送出。",
          401: "請先登入會員。",
          403: "目前無法完成此操作，請重新整理頁面並確認登入狀態。",
          404: "找不到此服務，請重新整理頁面後再試。",
          429: "操作較頻繁，請稍候再試。"
        };
        const response = apiError(upstream.status, messages[upstream.status] || "目前無法完成此操作，請確認資料後再試。");
        for (const cookie of upstream.headers.getSetCookie()) response.headers.append("Set-Cookie", cookie);
        const retryAfter = upstream.headers.get("Retry-After");
        if (retryAfter) response.headers.set("Retry-After", retryAfter);
        return response;
      }
      return apiError(502, "工作室服務回傳格式不正確，請稍後再試。");
    }
    return protectApiResponse(new Response(upstream.body, upstream));
  } catch {
    return apiError(502, "目前無法連線至工作室服務，請稍後再試。");
  } finally {
    clearTimeout(timeout);
  }
}
const index = {
  fetch(request, env) {
    return handleRequest(request, env);
  }
};
const workerEntry = index ?? {};
export {
  workerEntry as default,
  handleRequest
};
//# sourceMappingURL=index.js.map
