import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { apiClient } from '../src/api.js';
import { member, memberError, refreshingMember, refreshMember } from '../src/state.js';

const originalAdapter = apiClient.defaults.adapter;
const student = { displayName: '測試學生', roles: ['Student'] };
const response = (status, payload) => ({
  status,
  data: JSON.stringify(payload),
  headers: { 'content-type': 'application/json' },
});

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
  member.value = null;
  memberError.value = '';
});

test('讀取會員成功會更新會員並清除先前的連線提示', async () => {
  memberError.value = '先前暫時無法連線';
  apiClient.defaults.adapter = async config => {
    assert.equal(config.url, '/me');
    return response(200, student);
  };
  assert.equal(await refreshMember(), true);
  assert.deepEqual(member.value, student);
  assert.equal(memberError.value, '');
  assert.equal(refreshingMember.value, false);
});

test('401 才視為登入失效並清除會員資料', async () => {
  member.value = student;
  memberError.value = '先前暫時無法連線';
  apiClient.defaults.adapter = async () => response(401, {});
  assert.equal(await refreshMember(), false);
  assert.equal(member.value, null);
  assert.equal(memberError.value, '');
  assert.equal(refreshingMember.value, false);
});

test('403、429、503 不會把暫存會員改成登出', async () => {
  for (const status of [403, 429, 503]) {
    member.value = student;
    apiClient.defaults.adapter = async () => response(status, { message: '伺服器內部資訊' });
    assert.equal(await refreshMember(), false);
    assert.deepEqual(member.value, student);
    assert.match(memberError.value, /暫時保留上次會員資訊/);
    assert.doesNotMatch(memberError.value, /伺服器內部資訊/);
    assert.equal(refreshingMember.value, false);
  }
});

test('斷線和逾時保留會員，不丟出未處理的錯誤；重試可恢復', async () => {
  for (const code of ['ERR_NETWORK', 'ETIMEDOUT']) {
    member.value = student;
    apiClient.defaults.adapter = async () => { throw Object.assign(new Error('internal'), { code }); };
    assert.equal(await refreshMember(), false);
    assert.deepEqual(member.value, student);
    assert.match(memberError.value, /重新確認/);
  }
  apiClient.defaults.adapter = async () => response(200, student);
  assert.equal(await refreshMember(), true);
  assert.equal(memberError.value, '');
});

test('首次讀取失敗保持未知狀態，顯示中文重試提示', async () => {
  apiClient.defaults.adapter = async () => { throw new Error('offline'); };
  assert.equal(await refreshMember(), false);
  assert.equal(member.value, null);
  assert.match(memberError.value, /目前無法確認登入狀態/);
  assert.doesNotMatch(memberError.value, /上次會員資訊|offline/);
});

test('缺少必要欄位或意外空回應不能覆蓋已知會員', async () => {
  for (const result of [response(204, undefined), response(200, {}), response(200, []), response(200, { displayName: '學生', roles: 'Student' })]) {
    member.value = student;
    apiClient.defaults.adapter = async () => result;
    assert.equal(await refreshMember(), false);
    assert.deepEqual(member.value, student);
    assert.match(memberError.value, /暫時保留上次會員資訊/);
  }
});

test('較舊的 401 回應不能清掉後來成功取得的會員', async () => {
  let completeOld;
  let count = 0;
  apiClient.defaults.adapter = async () => {
    if (++count === 1) return new Promise(resolve => { completeOld = resolve; });
    return response(200, student);
  };
  const oldRequest = refreshMember();
  assert.equal(refreshingMember.value, true);
  assert.equal(await refreshMember(), true);
  completeOld(response(401, {}));
  assert.equal(await oldRequest, false);
  assert.deepEqual(member.value, student);
  assert.equal(memberError.value, '');
});

test('登出後才收到的會員回應不能恢復已清除的會員', async () => {
  member.value = student;
  let complete;
  apiClient.defaults.adapter = async () => new Promise(resolve => { complete = resolve; });
  const pending = refreshMember();
  member.value = null;
  complete(response(200, student));
  assert.equal(await pending, false);
  assert.equal(member.value, null);
  assert.equal(refreshingMember.value, false);
});
