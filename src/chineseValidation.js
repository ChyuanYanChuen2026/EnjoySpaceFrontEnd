// Only attached to registration and trial forms; native validation bubbles use
// these messages even when the browser's interface language is English.
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
