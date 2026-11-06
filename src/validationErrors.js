const labels = {
  account: '帳號', password: '密碼', confirmpassword: '確認密碼', name: '姓名',
  email: '電子郵件', phone: '手機', lineid: 'LINE ID', note: '備註', referrername: '介紹人姓名',
  sessionid: '上課場次', sessionids: '預約場次', planid: '體驗方案', reason: '取消原因',
  rowversion: '資料版本', batchkey: '預約識別碼', submissionkey: '申請識別碼',
};
function chinese(message) {
  return typeof message === 'string' && /[\u3400-\u9fff]/u.test(message) &&
    /^(?:[\u3400-\u9fff「（]|LINE ID|QR Code)/u.test(message.trim());
}
export function portalValidationMessage(payload, fallback) {
  const errors = payload.errors && typeof payload.errors === 'object' ? payload.errors : {};
  const messages = Object.entries(errors).flatMap(([key, values]) => {
    const field = key.replace(/^\$\.?/, '').replace(/\[\d+\]/g, '').split('.').pop().toLowerCase();
    const label = labels[field];
    return (Array.isArray(values) ? values : [values]).map(value => chinese(value) ? value :
      label ? `請確認${label}的格式與內容。` : '表單資料格式不正確，請確認後重新送出。');
  });
  if (messages.length) return [...new Set(messages)].join('；');
  return chinese(payload.message) ? payload.message : chinese(payload.detail) ? payload.detail : fallback;
}
