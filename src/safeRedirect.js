const portalOrigin = 'https://portal.invalid';
const knownPath = /^(?:\/(?:courses(?:\/[1-9][0-9]*(?:\/enroll)?)?|schedule|trial|check-in|studio|plans)|\/member(?:\/(?:enrollments|courses|makeup|trials))?|\/)$/;

// 登入後只返回已知的站內頁；保留 QR token 與報名／體驗的查詢參數。
export function safeRedirect(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f\u007f]/u.test(value)) return '/member';
  try {
    const target = new URL(value, portalOrigin);
    if (target.origin !== portalOrigin || !knownPath.test(target.pathname)) return '/member';
    return target.pathname + target.search + target.hash;
  } catch {
    return '/member';
  }
}
