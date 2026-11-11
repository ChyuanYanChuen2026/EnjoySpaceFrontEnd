import { isTaiwanMobile, TAIWAN_MOBILE_MESSAGE, portalValidationMessage } from './validationErrors.js';

const contactFields = ['phone', 'email', 'lineId'];

export function profileContactIssue(form) {
  if (typeof form.phone !== 'string' || form.phone === '') return '請填寫手機。';
  if (!isTaiwanMobile(form.phone)) return TAIWAN_MOBILE_MESSAGE;
  if (typeof form.email !== 'string' || !form.email.trim()) return '請填寫電子郵件。';
  if (form.email.length > 200) return '電子郵件最多可輸入 200 個字。';
  if (!/^[^\s@]+@[^\s@]+$/u.test(form.email)) return '請輸入有效的電子郵件，例如 name@example.com。';
  if (typeof form.lineId !== 'string' || form.lineId.length > 100) return 'LINE ID 最多可輸入 100 個字。';
  return '';
}

function readProfile(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      typeof value.account !== 'string' || typeof value.displayName !== 'string' ||
      !['studentNo', ...contactFields].every(key => value[key] === null || typeof value[key] === 'string') ||
      typeof value.rowVersion !== 'string' || !value.rowVersion) {
    const error = new Error('會員資料回應不完整，請查詢最新資料後再操作。');
    error.status = 502;
    throw error;
  }
  return Object.fromEntries(['account', 'studentNo', 'displayName', ...contactFields, 'rowVersion']
    .map(key => [key, contactFields.includes(key) ? value[key] ?? '' : value[key]]));
}

export function profilePayload(form, profile) {
  return { phone: form.phone, email: form.email, lineId: form.lineId, rowVersion: profile.rowVersion };
}

export function createProfileState() {
  return {
    profile: null, form: { phone: '', email: '', lineId: '' }, latest: null,
    loading: false, saving: false, blocked: false, forbidden: false, error: '', notice: '',
  };
}

export function profileIsDirty(state) {
  return Boolean(state.profile && contactFields.some(key => state.form[key] !== state.profile[key]));
}

// 讀取最新資料與採用最新資料分開，避免重整、衝突或逾時覆蓋尚未儲存的輸入。
export function createProfileEditor(state, { request, onUnauthorized = () => {}, onSaved = () => {} }) {
  let active = true;
  const apply = profile => {
    state.profile = profile;
    state.form = Object.fromEntries(contactFields.map(key => [key, profile[key]]));
    state.latest = null;
    state.blocked = false;
    state.error = '';
  };
  async function handleError(error, writing) {
    if (error?.status === 401 || error?.status === 403) {
      state.profile = null;
      state.latest = null;
      state.form = { phone: '', email: '', lineId: '' };
      state.blocked = true;
      state.forbidden = error.status === 403;
      state.error = error.status === 403 ? '此功能僅供有效的學生會員使用。' : '登入已逾時，請重新登入。';
      if (error.status === 401) await onUnauthorized();
      return;
    }
    if (writing && error?.status === 409) {
      state.blocked = true;
      state.error = '會員資料已由其他操作更新。已保留你的輸入，請先查詢最新資料，再載入後重新編輯。';
    } else if (writing && (!error?.status || error.status >= 500 || error.status === 408)) {
      state.blocked = true;
      state.error = '目前無法確認是否儲存成功。已保留你的輸入，請先查詢最新資料，避免重複送出。';
    } else {
      state.error = portalValidationMessage({ message: error?.message }, '無法完成操作，請稍後再試。');
    }
  }
  async function load() {
    if (!active || state.loading || state.saving || state.forbidden) return;
    state.loading = true;
    state.error = '';
    state.notice = '';
    try {
      const profile = readProfile(await request('/profile'));
      if (!active) return;
      if (state.profile) {
        state.latest = profile;
        state.blocked = state.blocked || profile.rowVersion !== state.profile.rowVersion;
        state.notice = '已取得最新資料。下方顯示目前儲存的聯絡資料，你尚未儲存的輸入仍保留。';
      } else apply(profile);
    } catch (error) {
      if (active) await handleError(error, false);
    } finally {
      if (active) state.loading = false;
    }
  }
  function useLatest() {
    if (!active || !state.latest || state.saving || state.loading) return;
    apply(state.latest);
    state.notice = '已載入最新資料，可以重新編輯。';
  }
  function cancel() {
    if (!active || !state.profile || state.saving || state.loading) return;
    state.form = Object.fromEntries(contactFields.map(key => [key, state.profile[key]]));
    state.notice = '已取消本次編輯。';
    if (!state.blocked) state.error = '';
  }
  async function save() {
    if (!active || !state.profile || state.loading || state.saving || state.blocked || !profileIsDirty(state)) return;
    state.error = profileContactIssue(state.form);
    state.notice = '';
    if (state.error) return;
    state.saving = true;
    state.latest = null;
    try {
      const result = await request('/profile', profilePayload(state.form, state.profile));
      if (!active) return;
      apply(readProfile(result?.profile));
      state.notice = '會員資料已更新。';
      // 聯絡資料已寫入成功，更新會員快取失敗不應誤報本次儲存失敗。
      try { await onSaved(); } catch { /* 共用會員資訊會在下次讀取時更新。 */ }
    } catch (error) {
      if (active) await handleError(error, true);
    } finally {
      if (active) state.saving = false;
    }
  }
  return { load, useLatest, cancel, save, dispose: () => { active = false; } };
}
