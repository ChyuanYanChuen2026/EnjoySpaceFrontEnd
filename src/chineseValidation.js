import { isTaiwanMobile, TAIWAN_MOBILE_MESSAGE } from './validationErrors.js';

// 表單送出前再次檢查文字；不改寫手機或密碼，也不取代後端驗證。
function textIssue(value, label, max, required = true) {
  if (typeof value !== 'string') return `請確認${label}的格式與內容。`;
  if (required && !value.trim()) return `請填寫${label}。`;
  return value.length > max ? `${label}不可超過 ${max} 個字元。` : '';
}

export function trialContactIssue(form) {
  const issue = textIssue(form.name, '姓名', 100)
    || textIssue(form.email, '電子郵件', 200)
    || textIssue(form.lineId ?? '', 'LINE ID', 100, false)
    || textIssue(form.note ?? '', '備註', 300, false)
    || textIssue(form.referrerName ?? '', '介紹人姓名', 100, false);
  if (issue) return issue;
  if (!isTaiwanMobile(form.phone)) return TAIWAN_MOBILE_MESSAGE;
  // HTML email input 另有瀏覽器格式驗證；這裡也阻擋程式帶入的空白／多個 @。
  if (!/^[^\s@]+@[^\s@]+$/u.test(form.email)) return '請輸入正確的電子郵件格式，例如 name@example.com。';
  return '';
}

export function loginFormIssue(form, registering = false) {
  const issue = textIssue(form.account, '帳號', 100) || textIssue(form.password, '密碼', 200);
  if (issue || !registering) return issue;
  if (form.password.length < 10) return '密碼至少需要 10 個字元。';
  const confirmationIssue = textIssue(form.confirmPassword, '確認密碼', 200);
  if (confirmationIssue) return confirmationIssue;
  if (form.password !== form.confirmPassword) return '兩次輸入的密碼不一致，請重新確認。';
  return trialContactIssue(form);
}

export function scheduleDateRangeIssue(from, until) {
  const parseDay = value => {
    if (typeof value !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) || value.startsWith('0000')) return NaN;
    const timestamp = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp : NaN;
  };
  const start = parseDay(from), end = parseDay(until);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return '請填寫有效的開始日期與結束日期。';
  if (end < start) return '結束日期不可早於開始日期。';
  // 結束日期為包含當日；後端使用不包含的次日零時，最多 93 天。
  if ((end - start) / 86400000 + 1 > 93) return '查詢日期範圍須在 93 天內（含起訖日期）。';
  return '';
}

// Attach locally to each form, including when the browser interface is English.
export function fieldValidationMessage(field) {
  if (!field.willValidate) return '';
  const label = field.dataset.validationLabel || '此欄位';
  const value = field.value || '';
  const validity = field.validity;
  const selection = field.tagName === 'SELECT' || field.type === 'radio' || field.type === 'checkbox';
  if (validity.valueMissing || (field.required && !value.trim()) ||
      (field.dataset.emptyValue !== undefined && value === field.dataset.emptyValue))
    return `請${selection ? '選擇' : '填寫'}${label}。`;
  if (validity.typeMismatch) return field.type === 'email' ? '請輸入正確的電子郵件格式，例如 name@example.com。' : `請輸入正確的${label}格式。`;
  // 手機等有專用格式提示的欄位，優先說明完整規則，避免只顯示字元長度。
  if (validity.patternMismatch && field.dataset.patternMessage) return field.dataset.patternMessage;
  const min = Number(field.getAttribute('minlength') ?? -1), max = Number(field.getAttribute('maxlength') ?? -1);
  if (value && min >= 0 && value.length < min) return `${label}至少需要 ${min} 個字元。`;
  if (max >= 0 && value.length > max) return `${label}不可超過 ${max} 個字元。`;
  if (field.dataset.matchName && value !== field.form?.elements.namedItem(field.dataset.matchName)?.value)
    return '兩次輸入的密碼不一致，請重新確認。';
  if (validity.rangeUnderflow) return `${label}不可小於 ${field.min}。`;
  if (validity.rangeOverflow) return `${label}不可大於 ${field.max}。`;
  if (validity.badInput || validity.patternMismatch || validity.stepMismatch) return `請輸入正確的${label}格式。`;
  return '';
}

const bindings = new WeakMap();
function fields(form) { return [...form.elements].filter(field => typeof field.setCustomValidity === 'function'); }
function update(field) {
  field.setCustomValidity('');
  const message = fieldValidationMessage(field);
  field.setCustomValidity(message);
  if (message) field.setAttribute('aria-invalid', 'true');
  else field.removeAttribute('aria-invalid');
  return message;
}
export const chineseValidation = {
  mounted(form) {
    // Validate before Vue's submit handler so every invalid control receives a
    // Chinese message, then let the browser focus and announce the first one.
    const originalNoValidate = form.noValidate;
    form.noValidate = true;
    const submit = event => {
      let invalid = false;
      for (const field of fields(form)) if (update(field)) invalid = true;
      if (invalid) { event.preventDefault(); event.stopImmediatePropagation(); form.reportValidity(); }
    };
    const input = event => {
      if (typeof event.target.setCustomValidity !== 'function') return;
      const field = event.target;
      if (field.getAttribute('aria-invalid') === 'true') update(field);
      else field.setCustomValidity('');
      for (const dependent of fields(form)) {
        if (dependent.dataset.matchName === field.name && dependent.getAttribute('aria-invalid') === 'true') update(dependent);
      }
    };
    // Also localize callers of checkValidity/reportValidity outside submit.
    const invalid = event => update(event.target);
    form.addEventListener('submit', submit, true);
    form.addEventListener('input', input);
    form.addEventListener('change', input);
    form.addEventListener('invalid', invalid, true);
    bindings.set(form, { submit, input, invalid, originalNoValidate });
  },
  updated(form) {
    for (const field of fields(form)) if (field.getAttribute('aria-invalid') === 'true') update(field);
  },
  beforeUnmount(form) {
    const handlers = bindings.get(form); if (!handlers) return;
    form.removeEventListener('submit', handlers.submit, true);
    form.removeEventListener('input', handlers.input);
    form.removeEventListener('change', handlers.input);
    form.removeEventListener('invalid', handlers.invalid, true);
    form.noValidate = handlers.originalNoValidate;
    bindings.delete(form);
  },
};
