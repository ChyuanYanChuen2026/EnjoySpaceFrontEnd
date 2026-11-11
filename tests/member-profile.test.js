import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfileState, createProfileEditor, profileContactIssue, profileIsDirty, profilePayload } from '../src/memberProfile.js';
import { TAIWAN_MOBILE_MESSAGE } from '../src/validationErrors.js';

const profile = (changes = {}) => ({
  account: 'test-student', studentNo: null, displayName: '隔離測試學員',
  phone: '0912345678', email: 'student@example.test', lineId: null, rowVersion: 'AAAAAAAAAAE=', ...changes,
});
const form = () => ({ phone: '0912345678', email: 'student@example.test', lineId: '' });
const rejected = status => Object.assign(new Error('無法完成操作。'), { status });
function deferred() {
  let resolve, reject;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

test('手機嚴格使用台灣 09 開頭 10 碼，不轉換符號、空白、全形或非字串', () => {
  assert.equal(profileContactIssue(form()), '');
  assert.match(profileContactIssue({ ...form(), phone: '' }), /請填寫手機/);
  for (const phone of ['091234567', '09123456789', '0812345678', '0912-345-678', '0912345678 ',
    ' 0912345678', '0912345678\n', '+886912345678', '０９１２３４５６７８']) {
    const draft = { ...form(), phone };
    assert.equal(profileContactIssue(draft), TAIWAN_MOBILE_MESSAGE, JSON.stringify(phone));
    assert.equal(draft.phone, phone);
  }
  assert.notEqual(profileContactIssue({ ...form(), phone: 912345678 }), '');
});

test('電子郵件必填且上限 200；LINE ID 可清空、上限 100，僅作文字傳送', () => {
  for (const email of ['', ' ', 'student', 'a@@example.test', 'a b@example.test', 'a'.repeat(190) + '@example.test', null]) {
    assert.notEqual(profileContactIssue({ ...form(), email }), '');
  }
  assert.equal(profileContactIssue({ ...form(), email: 'a'.repeat(187) + '@example.test' }), '');
  assert.equal(profileContactIssue({ ...form(), lineId: 'a'.repeat(100) }), '');
  assert.notEqual(profileContactIssue({ ...form(), lineId: 'a'.repeat(101) }), '');
  assert.equal(profileContactIssue({ ...form(), lineId: '<script>alert(1)</script>' }), '');
});

test('送出資料僅包含可修改的聯絡欄位與版本，不帶帳號、學號或學生 ID', () => {
  assert.deepEqual(profilePayload({ ...form(), account: 'tampered', studentNo: 'changed', studentId: 123 }, profile()), {
    ...form(), rowVersion: 'AAAAAAAAAAE=',
  });
});

test('初次讀取與取消編輯回復既有值，未配號與空 LINE 可正常顯示', async () => {
  const state = createProfileState();
  const editor = createProfileEditor(state, { request: async () => profile() });
  await editor.load();
  assert.equal(state.profile.studentNo, null);
  assert.equal(state.form.lineId, '');
  assert.equal(profileIsDirty(state), false);
  state.form.phone = '0999999999';
  assert.equal(profileIsDirty(state), true);
  editor.cancel();
  assert.equal(state.form.phone, '0912345678');
  assert.equal(profileIsDirty(state), false);
});

test('重整僅顯示最新摘要，不覆蓋草稿；採用最新資料才更新版本並解除限制', async () => {
  const state = createProfileState();
  let next = profile();
  const editor = createProfileEditor(state, { request: async () => next });
  await editor.load();
  state.form.phone = '0999999999';
  next = profile({ phone: '0988888888', rowVersion: 'AAAAAAAAAAI=' });
  await editor.load();
  assert.equal(state.form.phone, '0999999999');
  assert.equal(state.profile.rowVersion, 'AAAAAAAAAAE=');
  assert.equal(state.latest.phone, '0988888888');
  assert.equal(state.blocked, true);
  editor.useLatest();
  assert.equal(state.form.phone, '0988888888');
  assert.equal(state.profile.rowVersion, 'AAAAAAAAAAI=');
  assert.equal(state.blocked, false);
  assert.equal(state.latest, null);
});

test('送出中防止重複送出與讀取，成功採用後端資料並更新共用會員資訊', async () => {
  const pending = deferred();
  const state = createProfileState();
  const requests = [];
  let refreshCount = 0;
  const editor = createProfileEditor(state, {
    request: async (path, body) => { requests.push({ path, body }); return body ? pending.promise : profile(); },
    onSaved: () => { refreshCount++; },
  });
  await editor.load();
  state.form.lineId = 'new-line';
  const saving = editor.save();
  await editor.save();
  await editor.load();
  editor.cancel();
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[1].body, { ...form(), lineId: 'new-line', rowVersion: 'AAAAAAAAAAE=' });
  pending.resolve({ profile: profile({ lineId: 'new-line', rowVersion: 'AAAAAAAAAAI=' }) });
  await saving;
  assert.equal(state.saving, false);
  assert.equal(profileIsDirty(state), false);
  assert.equal(state.profile.lineId, 'new-line');
  assert.equal(refreshCount, 1);
  assert.equal(state.notice, '會員資料已更新。');
});

test('本機欄位驗證失敗不呼叫寫入 API，後端 400 可修正後再送出', async () => {
  const state = createProfileState();
  let writes = 0;
  const editor = createProfileEditor(state, {
    request: async (path, body) => { if (body) { writes++; throw rejected(400); } return profile(); },
  });
  await editor.load();
  state.form.phone = '0912-345-678';
  await editor.save();
  assert.equal(writes, 0);
  assert.equal(state.error, TAIWAN_MOBILE_MESSAGE);
  state.form.phone = '0999999999';
  await editor.save();
  assert.equal(writes, 1);
  assert.equal(state.blocked, false);
  assert.equal(state.form.phone, '0999999999');
});

test('409 衝突保留草稿並阻擋再次送出，取消編輯也不解除衝突限制', async () => {
  const state = createProfileState();
  let writes = 0;
  const editor = createProfileEditor(state, {
    request: async (path, body) => { if (body) { writes++; throw rejected(409); } return profile(); },
  });
  await editor.load();
  state.form.phone = '0999999999';
  await editor.save();
  assert.equal(state.form.phone, '0999999999');
  assert.equal(state.blocked, true);
  assert.match(state.error, /其他操作更新/);
  await editor.save();
  assert.equal(writes, 1);
  editor.cancel();
  assert.equal(state.blocked, true);
});

test('逾時、伺服器錯誤與回應不完整均不自動重送，先查詢再明確採用', async () => {
  for (const outcome of [rejected(0), rejected(500), rejected(408), {}]) {
    const state = createProfileState();
    let writes = 0;
    const editor = createProfileEditor(state, {
      request: async (path, body) => {
        if (!body) return profile({ lineId: writes ? 'saved-line' : null });
        writes++;
        if (outcome instanceof Error) throw outcome;
        return outcome;
      },
    });
    await editor.load();
    state.form.lineId = 'saved-line';
    await editor.save();
    assert.equal(state.blocked, true);
    assert.match(state.error, /無法確認是否儲存成功/);
    assert.equal(state.form.lineId, 'saved-line');
    await editor.save();
    assert.equal(writes, 1);
    await editor.load();
    assert.equal(state.form.lineId, 'saved-line');
    assert.equal(state.blocked, true);
    editor.useLatest();
    assert.equal(state.blocked, false);
    assert.equal(profileIsDirty(state), false);
  }
});

test('401 請重新登入、403 顯示學生資格提示，均清除頁面個資', async () => {
  for (const status of [401, 403]) {
    const state = createProfileState();
    let redirected = 0;
    const editor = createProfileEditor(state, {
      request: async (path, body) => { if (body) throw rejected(status); return profile(); },
      onUnauthorized: () => { redirected++; },
    });
    await editor.load();
    state.form.phone = '0999999999';
    await editor.save();
    assert.equal(state.profile, null);
    assert.deepEqual(state.form, { phone: '', email: '', lineId: '' });
    assert.equal(redirected, status === 401 ? 1 : 0);
    assert.equal(state.forbidden, status === 403);
  }
});

test('已完成寫入但會員快取更新失敗不誤報儲存失敗', async () => {
  const state = createProfileState();
  const editor = createProfileEditor(state, {
    request: async (path, body) => body ? { profile: profile({ phone: body.phone }) } : profile(),
    onSaved: () => { throw new Error('cache refresh'); },
  });
  await editor.load();
  state.form.phone = '0999999999';
  await editor.save();
  assert.equal(state.error, '');
  assert.equal(state.notice, '會員資料已更新。');
  assert.equal(state.blocked, false);
});

test('離開頁面後遲到的回應不得再次填入個資', async () => {
  const pending = deferred();
  const state = createProfileState();
  const editor = createProfileEditor(state, { request: () => pending.promise });
  const loading = editor.load();
  editor.dispose();
  pending.resolve(profile());
  await loading;
  assert.equal(state.profile, null);
});
