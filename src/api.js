export class ApiError extends Error { constructor(status, message) { super(message); this.status = status } }
let token = ''
export async function api(path, body) {
  if (body !== undefined && !token) token = (await api('/csrf')).token
  let response
  try { response = await fetch(`/api/portal${path}`, { credentials: 'same-origin', method: body === undefined ? 'GET' : 'POST', headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': token }, body: body === undefined ? undefined : JSON.stringify(body) }) }
  catch { throw new ApiError(0, '目前無法連線，請稍後再試。') }
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new ApiError(response.status, error.message || (response.status === 401 ? '請先登入會員。' : response.status === 403 ? '此帳號沒有使用此功能的權限。' : response.status === 429 ? '操作較頻繁，請稍候一分鐘再試。' : '資料讀取或送出失敗，請稍後再試。'))
  }
  if (['/login', '/logout'].includes(path)) token = ''
  return response.status === 204 ? undefined : response.json()
}
export const date = (v) => new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(v))
export const time = (v) => new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(v))
export const money = (v) => new Intl.NumberFormat('zh-TW').format(v)
