import axios from 'axios';
import { portalValidationMessage } from './validationErrors.js';

export const apiClient = axios.create({
  baseURL: '/api/portal',
  withCredentials: true,
  timeout: 15000,
  headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
  // Parse explicitly so an HTML proxy response cannot be mistaken for API data.
  responseType: 'text',
  transformResponse: [(data) => data],
  validateStatus: () => true,
});

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}
let token = '';
let pendingCsrf;
let csrfGeneration = 0;

function clearCsrf() {
  token = '';
  pendingCsrf = undefined;
  csrfGeneration++;
}

async function requestToken() {
  if (token) return token;
  if (!pendingCsrf) {
    const generation = csrfGeneration;
    const pending = api('/csrf').then(payload => {
      if (typeof payload?.token !== 'string' || !payload.token.trim() ||
          payload.token.length > 8192 || /\s/u.test(payload.token)) {
        throw new ApiError(502, '無法完成頁面驗證，請重新整理頁面後再試。');
      }
      if (generation !== csrfGeneration) {
        throw new ApiError(400, '登入狀態已變更，請重新確認資料後再送出。');
      }
      token = payload.token;
      return token;
    }).finally(() => {
      if (pendingCsrf === pending) pendingCsrf = undefined;
    });
    pendingCsrf = pending;
  }
  return pendingCsrf;
}

function uncertainOutcome(path) {
  if (path === '/login') return '登入結果尚未確認，請重新整理頁面後再試。';
  if (path === '/logout') return '登出結果尚未確認，請重新整理頁面確認。';
  if (path === '/register') return '帳號建立結果尚未確認，請先嘗試登入，避免重複註冊。';
  return '尚無法確認送出結果，請先查詢紀錄或聯繫工作室，避免重複送出。';
}

function fallbackMessage(status, writing, path) {
  if (status === 401) return '請先登入會員；若已登入，請重新登入後再試。';
  if (status === 403) return '此帳號沒有使用此功能的權限，或頁面驗證已失效，請重新確認。';
  if (status === 404) return '找不到此資料，請重新整理頁面後再試。';
  if (status === 409) return '資料已更新或目前無法完成操作，請先重新整理確認紀錄。';
  if (status === 429) return '操作較頻繁，請稍後再試。';
  if (status === 400) return '表單驗證失敗或頁面已過期，請確認資料後再送出；若仍失敗，請重新整理頁面。';
  if (status === 422) return '表單資料不符合規則，請確認後重新送出。';
  return writing ? `工作室服務暫時無法回應。${uncertainOutcome(path)}` : '目前無法取得工作室資料，請稍後再試。';
}

export async function api(path, body) {
  // 所有 API 都只能使用本站相對路徑，不能將防偽 Token 送到外部網址。
  if (typeof path !== 'string' || !/^\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\/?(?:\?[^#\s\\]*)?$/.test(path)) {
    throw new ApiError(400, '服務網址不正確，請重新整理頁面後再試。');
  }
  const writing = body !== undefined;
  const requestCsrf = writing ? await requestToken() : undefined;
  let response;
  try {
    response = await apiClient.request({
      url: path,
      method: writing ? 'POST' : 'GET',
      headers: writing ? { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': requestCsrf } : {},
      data: body,
    });
  } catch (error) {
    const timedOut = ['ECONNABORTED', 'ETIMEDOUT'].includes(error?.code);
    const message = timedOut ? '連線逾時。' : '目前無法連線。';
    // 連線失敗不代表後台沒有完成寫入，不能自動重送申請或打卡。
    throw new ApiError(0, message + (writing ? uncertainOutcome(path) : '請檢查網路連線後再試。'));
  }
  let payload;
  const contentType = String(response.headers?.get?.('content-type') || response.headers?.['content-type'] || '')
    .split(';')[0].trim().toLowerCase();
  if (contentType === 'application/json' || /^application\/[a-z0-9.+-]+\+json$/.test(contentType)) {
    try { payload = JSON.parse(response.data); } catch { /* 下方統一處理格式錯誤，不輸出原始回應。 */ }
  }
  if (response.status < 200 || response.status >= 300) {
    const error = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
    if ([400, 401, 403].includes(response.status)) clearCsrf();
    const fallback = fallbackMessage(response.status, writing, path);
    // 5xx 一律隱藏伺服器訊息；4xx 才接受既有中文業務／欄位驗證提示。
    const failure = new ApiError(response.status, response.status >= 500 ? fallback : portalValidationMessage(error, fallback));
    if (typeof error.code === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(error.code)) failure.code = error.code;
    if (Number.isSafeInteger(error.sessionId) && error.sessionId > 0) failure.sessionId = error.sessionId;
    throw failure;
  }
  if (['/login', '/logout'].includes(path)) clearCsrf();
  if (response.status === 204) return undefined;
  if (!payload || typeof payload !== 'object') {
    // HTTP 200 的 HTML 錯誤頁同樣不能當成成功；打卡流程會先查詢結果。
    throw new ApiError(502, '伺服器回傳格式不正確。' + (writing ? uncertainOutcome(path) : '請稍後再試。'));
  }
  return payload;
}
export const date = (v) => new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(new Date(v));
export const time = (v) => new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(v));
export const money = (v) => new Intl.NumberFormat("zh-TW", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
export const validity = (plan) => plan.validityText || (plan.validityUnit === "Unlimited" ? "不限期" : plan.validityUnit === "Days" ? `${plan.validityValue} 天（含生效日）` : plan.validityUnit === "Months" ? `${plan.validityValue} 個月` : plan.validityUnit === "Session" ? "依堂次使用" : "請洽工作室確認效期");
export const audience = (plan) => plan.audienceText || { TrialGuest: "體驗生", Student: "正式學生" }[plan.audienceType] || plan.audienceType;
export const calendarDate = (v) => (v ? v.slice(0, 10).replaceAll("-", "/") : "尚未設定");
