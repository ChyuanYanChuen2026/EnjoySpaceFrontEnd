export function checkInError(error = {}, submitted = false) {
  let action = 'retry';
  if (error.code === 'QR_EXPIRED' || error.code === 'QR_INVALID') action = 'scan';
  else if (['NOT_ON_ROSTER', 'STUDENT_REQUIRED'].includes(error.code) || error.status === 403) action = 'account';
  else if (['ATTENDANCE_LOCKED', 'CHECK_IN_CLOSED', 'SESSION_CANCELLED'].includes(error.code)) action = 'staff';
  else if (submitted && (error.code === 'ATTENDANCE_CONFLICT' || !error.status || error.status >= 500)) action = 'verify';
  return { action, message: error.message || (action === 'verify' ? '連線中斷，尚無法確認打卡結果。請先查詢紀錄，避免重複操作。' : '打卡未完成，請重新確認；若仍有問題，請洽系統管理員。') };
}
export function createCheckInFlow({ request, save = () => {}, login = () => {}, state: supplied } = {}) {
  const state = supplied || {};
  Object.assign(state, { phase: 'scan', busy: false, details: null, error: null, notice: '' });
  let token = '', sessionId = null, revision = 0;
  function apply(data) {
    state.details = data; sessionId = data.sessionId; state.error = null;
    state.phase = data.status === 'Present' ? 'present' : data.status === 'Late' ? 'late' : data.canCheckIn ? 'ready' : 'locked';
    save({ token, sessionId });
  }
  function fail(e, submitted) {
    if (e.status === 401) { state.phase = 'login'; save({ token, sessionId }); login(); return; }
    if (e.sessionId) sessionId = e.sessionId;
    state.phase = 'error'; state.error = checkInError(e, submitted);
  }
  async function receipt(version, expired = false) {
    try {
      const data = await request(`/check-in/sessions/${sessionId}/receipt`);
      if (version !== revision) return;
      if (expired && !['Present', 'Late'].includes(data.status)) { fail({ code: 'QR_EXPIRED', message: '此 QR Code 已失效，請重新掃描課堂 QR Code。' }); return; }
      apply(data);
      if (state.phase === 'ready') state.notice = '目前尚無出席紀錄，請確認課堂後再按「打卡上課」。';
    } catch(e) { if(version === revision) fail(e, true); }
  }
  async function preview(value, savedSessionId) {
    const version = ++revision; token = value; sessionId = savedSessionId || null;
    Object.assign(state, { busy: true, error: null, notice: '', details: null, phase: 'loading' });
    try { const data = await request('/check-in/preview', { token }); if(version === revision) apply(data); }
    catch(e) { if(version !== revision) return; if(e.code === 'QR_EXPIRED' && sessionId) await receipt(version, true); else fail(e, false); }
    finally { if(version === revision) state.busy = false; }
  }
  async function submit() {
    if (state.busy || state.phase !== 'ready') return;
    const version = revision; state.busy = true; state.phase = 'submitting';
    try { const data = await request('/check-in', { token }); if(version === revision) apply(data); }
    catch(e) { if(version === revision) fail(e, true); }
    finally { if(version === revision) state.busy = false; }
  }
  async function retry() {
    if(state.busy) return;
    if(state.error?.action === 'verify' && sessionId) { state.busy = true; const version = revision; await receipt(version); if(version === revision) state.busy = false; }
    else if(state.error?.action === 'retry') await preview(token, sessionId);
  }
  function clear() { revision++; token = ''; sessionId = null; Object.assign(state, { phase: 'scan', details: null, busy: false, error: null, notice: '' }); save(null); }
  return { state, preview, submit, retry, clear };
}
