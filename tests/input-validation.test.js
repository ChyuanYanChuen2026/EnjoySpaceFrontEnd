import test from 'node:test';
import assert from 'node:assert/strict';
import { fieldValidationMessage, loginFormIssue, trialContactIssue, scheduleDateRangeIssue } from '../src/chineseValidation.js';
import { isTaiwanMobile, TAIWAN_MOBILE_MESSAGE } from '../src/validationErrors.js';
import { trialApplicationIssue, trialBookingIssue } from '../src/trialApplication.js';

const validForm = () => ({
  account: 'student-01', name: '測試學員', email: 'student@example.test',
  phone: '0912345678', password: 'valid-password', confirmPassword: 'valid-password',
  lineId: '', note: '', referrerName: '',
});

test('註冊與體驗接受相同的手機；不轉換空白、符號、國際格式或全形數字', () => {
  assert.equal(loginFormIssue(validForm(), true), '');
  assert.equal(trialContactIssue(validForm()), '');
  for (const phone of ['091234567', '09123456789', '0812345678', '0912-345-678', '+886912345678',
    '０９１２３４５６７８', '0912345678 ', ' 0912345678', '0912345678\n', '09123\t5678', 912345678]) {
    assert.equal(isTaiwanMobile(phone), false, String(phone));
    const form = { ...validForm(), phone };
    assert.equal(loginFormIssue(form, true), TAIWAN_MOBILE_MESSAGE);
    assert.equal(trialContactIssue(form), TAIWAN_MOBILE_MESSAGE);
    assert.equal(form.phone, phone, '不得正規化後放行');
  }
});

test('註冊檢查空白、文字型別、長度及兩次密碼；登入保留既有密碼長度規則', () => {
  for (const account of ['', '  ', 123, null, 'a'.repeat(101)]) {
    assert.notEqual(loginFormIssue({ ...validForm(), account }, true), '');
  }
  assert.match(loginFormIssue({ ...validForm(), password: 'short' }, true), /至少需要 10/);
  assert.match(loginFormIssue({ ...validForm(), confirmPassword: 'different-password' }, true), /不一致/);
  assert.match(loginFormIssue({ ...validForm(), confirmPassword: '' }, true), /填寫確認密碼/);
  assert.equal(loginFormIssue({ account: 'existing', password: 'short' }), '');
  const form = { ...validForm(), password: '  valid-password  ', confirmPassword: '  valid-password  ' };
  assert.equal(loginFormIssue(form, true), '');
  assert.equal(form.password, '  valid-password  ', '不得修剪密碼');
});

test('聯絡資料限制與後端一致，備註文字不被當作 HTML 處理或自行刪字', () => {
  for (const change of [
    { name: '　 ' }, { name: '字'.repeat(101) }, { email: 'a@@example.test' },
    { email: 'student' }, { email: 'a'.repeat(201) }, { lineId: 'a'.repeat(101) },
    { note: '字'.repeat(301) }, { referrerName: '字'.repeat(101) }, { name: {} },
  ]) assert.notEqual(trialContactIssue({ ...validForm(), ...change }), '');
  const form = { ...validForm(), note: '<script>alert("test")</script>' };
  assert.equal(trialContactIssue(form), '');
  assert.equal(form.note, '<script>alert("test")</script>', '輸出安全由 Vue 文字插值負責');
});

test('日期範圍接受有效單日、跨月、閏日及含起訖共 93 天', () => {
  for (const [from, until] of [
    ['2026-11-10', '2026-11-10'], ['2026-12-31', '2027-01-01'],
    ['2028-02-29', '2028-03-01'], ['2026-01-01', '2026-04-03'],
  ]) assert.equal(scheduleDateRangeIssue(from, until), '');
  assert.match(scheduleDateRangeIssue('2026-01-01', '2026-04-04'), /93 天/);
});

test('日期範圍拒絕空值、反向、非日期及不存在日期，避免 toISOString 例外', () => {
  for (const [from, until] of [
    ['', '2026-11-10'], ['2026-11-10', ''], [null, '2026-11-10'],
    ['2026-02-29', '2026-03-01'], ['2026-13-01', '2026-13-03'],
    ['2026-11-11', '2026-11-10'], ['2026-11-01T00:00:00Z', '2026-11-10'],
    ['0000-01-01', '0000-01-02'], ['2026-1-1', '2026-01-02'],
  ]) assert.notEqual(scheduleDateRangeIssue(from, until), '');
});

const now = Date.parse('2026-11-10T12:00:00+08:00');
const options = {
  remaining: 3,
  sessions: [1, 2, 3].map(id => ({ id, startsAt: '2026-11-11T12:00:00+08:00' })),
};
const booking = (choices, extra = {}) => trialBookingIssue({ choices, options, now, ...extra });

test('體驗預約接受單堂與多堂，拒絕重複、空值、字串及非正整數 ID', () => {
  assert.equal(booking([1]), '');
  assert.equal(booking([1, 2, 3]), '');
  assert.match(booking([1, 1]), /重複/);
  for (const value of [0, -1, 1.5, '1', NaN, Infinity, 2147483648]) assert.notEqual(booking([value]), '');
  assert.match(booking([]), /至少選擇一堂/);
  assert.notEqual(booking(null), '');
});

test('體驗預約必須在可選場次且未開課，不能超過剩餘堂數或單次 20 堂', () => {
  assert.match(booking([4]), /可選範圍/);
  assert.match(booking([1, 2], { options: { ...options, remaining: 1 } }), /堂數不足/);
  assert.match(booking([1], { options: null }), /重新選擇/);
  assert.match(booking([1], { options: { ...options, sessions: [{ id: 1, startsAt: new Date(now).toISOString() }] } }), /已開始/);
  assert.match(booking([1], { options: { ...options, sessions: [{ id: 1, startsAt: 'invalid' }] } }), /可選範圍/);
  assert.match(booking(Array.from({ length: 21 }, (_, index) => index + 1)), /最多預約 20/);
});

test('體驗初次申請拒絕未選方案、無效時間、已開課、額滿及缺少介紹人', () => {
  const data = {
    member: { roles: ['Student'] }, plans: [{ id: 1, requiresReferrer: false }], planId: 1,
    session: { startsAt: '2026-11-11T12:00:00+08:00', enrolled: 0, capacity: 10 }, now,
  };
  assert.equal(trialApplicationIssue(data), '');
  assert.notEqual(trialApplicationIssue({ ...data, planId: 2 }), '');
  assert.match(trialApplicationIssue({ ...data, session: { ...data.session, startsAt: 'invalid' } }), /時間資料不正確/);
  assert.match(trialApplicationIssue({ ...data, session: { ...data.session, startsAt: new Date(now).toISOString() } }), /已開始/);
  assert.match(trialApplicationIssue({ ...data, session: { ...data.session, enrolled: 10 } }), /額滿/);
  assert.match(trialApplicationIssue({ ...data, plans: [{ id: 1, requiresReferrer: true }], referrerName: ' ' }), /介紹人/);
});

function field(overrides = {}) {
  return {
    willValidate: true, dataset: { validationLabel: '姓名' }, value: '', required: true,
    tagName: 'INPUT', type: 'text', validity: {}, getAttribute: () => null, ...overrides,
  };
}

test('原生表單驗證提示為中文，專用手機提示優先於長度訊息', () => {
  assert.equal(fieldValidationMessage(field()), '請填寫姓名。');
  assert.equal(fieldValidationMessage(field({ tagName: 'SELECT', dataset: { validationLabel: '上課場次', emptyValue: '0' }, value: '0' })), '請選擇上課場次。');
  assert.equal(fieldValidationMessage(field({ value: '09123', validity: { patternMismatch: true }, dataset: { validationLabel: '手機', patternMessage: TAIWAN_MOBILE_MESSAGE }, getAttribute: name => name === 'minlength' ? '10' : null })), TAIWAN_MOBILE_MESSAGE);
  assert.match(fieldValidationMessage(field({ type: 'email', value: 'bad', validity: { typeMismatch: true } })), /電子郵件格式/);
  assert.equal(fieldValidationMessage(field({ willValidate: false })), '');
});
