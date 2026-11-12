// Cloudflare Pages: browser gọi /api cùng origin để giữ cookie HttpOnly.
export async function onRequest({ request, env }) {
  let origin;
  try {
    const hostname = new URL(request.url).hostname;
    const isPagesDev = hostname.endsWith('.pages.dev') || hostname === 'localhost' || hostname === '127.0.0.1';
    const fallbackOrigin = isPagesDev ? 'https://bao-cao-ctulib.onrender.com' : '';
    const configuredOrigin = env.API_ORIGIN || fallbackOrigin;
    origin = new URL(configuredOrigin);
    if (origin.protocol !== 'https:' || origin.username || origin.password ||
        origin.pathname !== '/' || origin.search || origin.hash ||
        origin.origin === new URL(request.url).origin) throw new Error('Invalid API origin');
  } catch {
    return Response.json({ status: 'error', message: 'API chưa được cấu hình' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    });
  }

  const incoming = new URL(request.url);
  const target = new URL(origin.origin);
  target.pathname = incoming.pathname;
  target.search = incoming.search;
  const headers = new Headers(request.headers);
  headers.delete('host');
  // Giữ nguyên Origin: backend vẫn kiểm tra CSRF, không thay bằng origin tin cậy.
  const init = { method: request.method, headers, redirect: 'manual' };
  if (!['GET', 'HEAD'].includes(request.method)) init.body = request.body;
  try {
    const upstream = await fetch(target, { ...init, cf: { cacheTtl: 0, cacheEverything: false } });
    const response = new Response(upstream.body, upstream);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch {
    return Response.json({ status: 'error', message: 'Không thể kết nối máy chủ' }, {
      status: 502, headers: { 'Cache-Control': 'no-store' },
    });
  }
}
