const requestHeaderNames = [
  'accept', 'accept-language', 'content-type', 'cookie',
  'origin', 'referer', 'x-csrf-token', 'x-requested-with',
];

function apiError(status, message) {
  return new Response(JSON.stringify({ message }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, private',
      'CDN-Cache-Control': 'no-store',
      'Cloudflare-CDN-Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function backendOrigin(value, portalOrigin) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase();
    // 正式後台只接受完整 HTTPS 網域，避免把本機開發網址或金鑰誤填進設定。
    if (url.protocol !== 'https:' || url.username || url.password ||
        url.pathname !== '/' || url.search || url.hash ||
        !hostname.includes('.') || /^[\d.]+$/.test(hostname) || hostname.includes(':') ||
        hostname.endsWith('.localhost') || hostname.endsWith('.local') ||
        url.origin === portalOrigin) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export async function handleRequest(request, env, fetchUpstream = fetch) {
  const incoming = new URL(request.url);
  const isApi = /^\/api(?:\/|$)/i.test(incoming.pathname);
  if (!isApi) return env.ASSETS.fetch(request);

  // 既有 API 的路徑只有英文、數字及連字號；不轉送編碼分隔符或雙重編碼路徑。
  if (!/^\/api\/portal(?:\/[A-Za-z0-9_-]+)*\/?$/.test(incoming.pathname)) {
    return apiError(404, '找不到此服務，請重新整理頁面後再試。');
  }

  const origin = backendOrigin(env.API_ORIGIN, incoming.origin);
  if (!origin) return apiError(503, '網站服務尚未完成設定，請稍後再試。');

  const target = new URL(origin);
  target.pathname = incoming.pathname;
  target.search = incoming.search;
  const headers = new Headers();
  // 使用白名單，防止用戶提供 Host、Forwarded 或 X-Forwarded-* 冒充可信代理。
  for (const name of requestHeaderNames) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  headers.set('Cache-Control', 'no-store');

  try {
    const upstream = await fetchUpstream(target.href, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      duplex: 'half',
      redirect: 'manual',
      cache: 'no-store',
      cf: { cacheEverything: false, cacheTtlByStatus: { '100-599': -1 } },
    });
    // API 不追隨轉址，避免把 Cookie 與防偽 Token 送到轉址目的地。
    if (upstream.status >= 300 && upstream.status < 400 || upstream.status >= 500) {
      await upstream.body?.cancel();
      return apiError(502, '目前無法連線至工作室服務，請稍後再試。');
    }

    // 從原 Response 複製標頭，保留登入與防偽 Cookie 的多筆 Set-Cookie。
    const response = new Response(upstream.body, upstream);
    response.headers.set('Cache-Control', 'no-store, private');
    response.headers.set('CDN-Cache-Control', 'no-store');
    response.headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.delete('Server');
    response.headers.delete('X-Powered-By');
    return response;
  } catch {
    return apiError(502, '目前無法連線至工作室服務，請稍後再試。');
  }
}

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  },
};
