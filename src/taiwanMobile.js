// Shared by registration and trial application fields and submit guards.
// Accept exactly ten ASCII digits, starting with 09, without separators.
export const TAIWAN_MOBILE_PATTERN = '09[0-9]{8}';
export const TAIWAN_MOBILE_MESSAGE = '請輸入 09 開頭的 10 碼手機號碼，例如 0912345678（不含空格或符號）。';
const mobilePattern = new RegExp(`^(?:${TAIWAN_MOBILE_PATTERN})(?![\\s\\S])`, 'u');

export function isTaiwanMobile(value) {
  return typeof value === 'string' && value.length === 10 && mobilePattern.test(value);
}
