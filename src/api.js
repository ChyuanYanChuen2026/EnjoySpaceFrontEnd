export class ApiError extends Error { constructor(status, message) { super(message); this.status = status } }
let token = ''
export async function api(path, body) {
  if (body !== undefined && !token) token = (await api('/csrf')).token
  let response
  try { response = await fetch(`/api/portal${path}`, { cache: 'no-store', credentials: 'same-origin', method: body === undefined ? 'GET' : 'POST', headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': token }, body: body === undefined ? undefined : JSON.stringify(body) }) }
  catch { throw new ApiError(0, '目前無法連線，請稍後再試。') }
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    if (response.status === 401 || response.status === 400) token = ''
    const validation = error.errors ? Object.values(error.errors).flat().join('；') : ''
    const fallback = response.status === 401 ? '請先登入會員。' : response.status === 403 ? '此帳號沒有使用此功能的權限。' : response.status === 429 ? '操作較頻繁，請稍候一分鐘再試。' : response.status === 400 ? '表單驗證失敗，請確認資料後重新送出。' : '目前無法取得工作室資料，請稍後再試。'
    throw new ApiError(response.status, error.message || validation || (response.status < 500 ? error.detail : '') || fallback)
  }
  if (['/login', '/logout'].includes(path)) token = ''
  if (response.status === 204) return undefined
  try { return await response.json() } catch { throw new ApiError(response.status, '伺服器回傳格式不正確，請稍後再試。') }
}
export const date = (v) => new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(v))
export const time = (v) => new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(v))
export const money = (v) => new Intl.NumberFormat('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
export const validity = (plan) => plan.validityText || (plan.validityUnit === 'Unlimited' ? '不限期' : plan.validityUnit === 'Days' ? `${plan.validityValue} 天（含生效日）` : plan.validityUnit === 'Months' ? `${plan.validityValue} 個月` : plan.validityUnit === 'Session' ? '依堂次使用' : '請洽工作室確認效期')
export const audience = (plan) => plan.audienceText || ({ TrialGuest: '體驗生', Student: '正式學生' }[plan.audienceType] || plan.audienceType)
export const calendarDate = (v) => v ? v.slice(0, 10).replaceAll('-', '/') : '尚未設定'
