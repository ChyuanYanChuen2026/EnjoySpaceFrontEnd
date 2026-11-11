// 註冊與體驗申請共用：僅接受 09 開頭的 10 碼 ASCII 數字，不接受空格或符號。
export const TAIWAN_MOBILE_PATTERN = '09[0-9]{8}';
export const TAIWAN_MOBILE_MESSAGE = '請輸入 09 開頭的 10 碼手機號碼，例如 0912345678（不含空格或符號）。';
const mobilePattern = new RegExp(`^(?:${TAIWAN_MOBILE_PATTERN})(?![\\s\\S])`, 'u');

export function isTaiwanMobile(value) {
  return typeof value === 'string' && value.length === 10 && mobilePattern.test(value);
}

// 將 API 欄位驗證錯誤整理成學生可理解的中文提示。
const labels = {
  account: '帳號', password: '密碼', confirmpassword: '確認密碼', name: '姓名',
  email: '電子郵件', phone: '手機', lineid: 'LINE ID', note: '備註', referrername: '介紹人姓名',
  sessionid: '上課場次', sessionids: '預約場次', planid: '體驗方案', reason: '原因',
  rowversion: '資料版本', batchkey: '預約識別碼', submissionkey: '申請識別碼',
  courseid: '課程', confirmationtoken: '報名確認資料', paymentmethod: '付款方式',
  confirmdetails: '報名資料確認', confirmpolicy: '報名規則確認', participantid: '上課紀錄',
  entitlementid: '補課資格', targetsessionid: '補課場次', targetrowversion: '場次資料版本',
  token: '打卡代碼', from: '開始日期', until: '結束日期', termid: '學期',
};
function chinese(message) {
  // 僅展示簡短的中文業務提示；HTML、堆疊與連線資訊不能當作學生提示。
  return typeof message === 'string' && message.length <= 600 &&
    /[\u3400-\u9fff]/u.test(message) &&
    /^(?:[\u3400-\u9fff「（]|LINE ID|QR Code)/u.test(message.trim()) &&
    !/[<>\x00-\x08\x0b\x0c\x0e-\x1f]/u.test(message) &&
    !/(?:\b(?:System|Microsoft)\.|Exception\b|StackTrace\b|stack trace|(?:Password|Pwd|ConnectionString)\s*[=:])/iu.test(message);
}
export function portalValidationMessage(payload = {}, fallback = '請確認欄位資料後再送出。') {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return fallback;
  const errors = payload.errors && typeof payload.errors === 'object' && !Array.isArray(payload.errors) ? payload.errors : {};
  const messages = Object.entries(errors).flatMap(([key, values]) => {
    const field = key.replace(/^\$\.?/, '').replace(/\[\d+\]/g, '').split('.').pop().toLowerCase();
    const label = labels[field];
    return (Array.isArray(values) ? values : [values]).map(value => chinese(value) ? value.trim() :
      label ? `請確認${label}的格式與內容。` : '表單資料格式不正確，請確認後重新送出。');
  });
  if (messages.length) return [...new Set(messages)].join('；');
  return chinese(payload.message) ? payload.message.trim() : chinese(payload.detail) ? payload.detail.trim() : fallback;
}
