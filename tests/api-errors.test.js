import assert from 'node:assert/strict';
import { test } from 'node:test';
import { portalValidationMessage } from '../src/validationErrors.js';

let moduleNumber = 0;
async function client(handler) {
  const module = await import(`../src/api.js?test=${++moduleNumber}`);
  const calls = [];
  module.apiClient.defaults.adapter = async config => {
    calls.push(config);
    return { config, statusText: '', ...await handler(config, calls) };
  };
  return { ...module, calls };
}

function json(data, status = 200, type = 'application/json; charset=utf-8') {
  return { status, data: JSON.stringify(data), headers: { 'content-type': type } };
}

test('JSON GET 保留同源 Cookie 與逾時設定，不要求防偽 token', async () => {
  const { api, calls } = await client(() => json({ courses: [] }));
  assert.deepEqual(await api('/catalog'), { courses: [] });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].baseURL, '/api/portal');
  assert.equal(calls[0].withCredentials, true);
  assert.equal(calls[0].timeout, 15000);
  assert.equal(calls[0].method, 'get');
});

test('同時送出的請求共用一次 CSRF 取得，沒有自動重送 POST', async () => {
  const { api, calls } = await client(config => config.url === '/csrf'
    ? json({ token: 'csrf-valid' }) : json({ id: 1 }));
  await Promise.all([api('/learning/leaves', {}), api('/makeup/requests', {})]);
  assert.equal(calls.filter(c => c.url === '/csrf').length, 1);
  const posts = calls.filter(c => c.method === 'post');
  assert.equal(posts.length, 2);
  for (const post of posts) assert.equal(post.headers.get('X-CSRF-TOKEN'), 'csrf-valid');
});

test('登入與登出後改取新的 CSRF；204 是合法成功回應', async () => {
  let issued = 0;
  const { api, calls } = await client(config => {
    if (config.url === '/csrf') return json({ token: `token-${++issued}` });
    if (config.url === '/logout') return { status: 204, data: '', headers: {} };
    return json({ id: 1 });
  });
  await api('/login', {});
  await api('/learning/leaves', {});
  assert.equal(await api('/logout', {}), undefined);
  await api('/login', {});
  assert.equal(issued, 3);
  assert.deepEqual(calls.filter(c => c.method === 'post').map(c => c.headers.get('X-CSRF-TOKEN')),
    ['token-1', 'token-2', 'token-2', 'token-3']);
});

for (const status of [400, 403]) {
  test(`${status} 驗證失敗不重送；下次手動送出會更新 CSRF`, async () => {
    let issued = 0;
    const { api, calls } = await client(config => config.url === '/csrf'
      ? json({ token: `token-${++issued}` }) : { status, data: '', headers: {} });
    await assert.rejects(api('/learning/leaves', {}), error => {
      assert.equal(error.status, status);
      assert.match(error.message, /驗證/);
      return true;
    });
    assert.equal(calls.filter(c => c.method === 'post').length, 1);
    await assert.rejects(api('/learning/leaves', {}));
    assert.equal(issued, 2);
    assert.equal(calls.filter(c => c.method === 'post').length, 2);
  });
}

for (const token of [undefined, '', '  ', 7, 'csrf\ninvalid']) {
  test(`不合法 CSRF token ${JSON.stringify(token)} 會阻止 POST`, async () => {
    const { api, calls } = await client(() => json({ token }));
    await assert.rejects(api('/trial-requests', {}), /無法完成頁面驗證/);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, '/csrf');
  });
}

test('CSRF 取得失敗可以再次嘗試，未送出任何申請', async () => {
  let tries = 0;
  const { api, calls } = await client(config => {
    if (config.url === '/csrf' && tries++ === 0) throw Object.assign(new Error('raw network details'), { code: 'ERR_NETWORK' });
    return config.url === '/csrf' ? json({ token: 'ok' }) : json({ id: 1 });
  });
  await assert.rejects(api('/trial-requests', {}), /目前無法連線/);
  assert.equal(calls.filter(c => c.method === 'post').length, 0);
  await api('/trial-requests', {});
  assert.equal(calls.filter(c => c.method === 'post').length, 1);
});

test('登入狀態變更時，尚未完成的舊 CSRF 不得重新覆寫目前狀態', async () => {
  let completeCsrf;
  const response = new Promise(resolve => { completeCsrf = resolve; });
  const { api, calls } = await client(config => config.url === '/csrf'
    ? response : json({}, 401));
  const writing = api('/learning/leaves', {});
  const rejected = assert.rejects(writing, /登入狀態已變更/);
  await assert.rejects(api('/me'));
  completeCsrf(json({ token: 'stale-token' }));
  await rejected;
  assert.equal(calls.filter(c => c.method === 'post').length, 0);
});

test('401 顯示中文登入失敗原因，非英文 HTTP 訊息', async () => {
  const { api } = await client(config => config.url === '/csrf' ? json({ token: 'ok' })
    : json({ message: '帳號或密碼錯誤，或此帳號無官網使用權限。' }, 401));
  await assert.rejects(api('/login', {}), /帳號或密碼錯誤/);
});

test('429 HTML 錯誤頁使用中文提示，不暴露原始內容或宣稱固定一分鐘', async () => {
  const { api } = await client(() => ({ status: 429, data: '<html>Too many requests: trace-secret</html>', headers: { 'content-type': 'text/html' } }));
  await assert.rejects(api('/catalog'), error => {
    assert.equal(error.status, 429);
    assert.equal(error.message, '操作較頻繁，請稍後再試。');
    return true;
  });
});

test('所有端點的英文欄位錯誤會轉為中文，不只註冊與體驗', async () => {
  const { api } = await client(config => config.url === '/csrf' ? json({ token: 'ok' })
    : json({ errors: { 'input.PaymentMethod': ['The PaymentMethod field is required.'], 'input.CourseId': ['The value is invalid.'] } }, 400, 'application/problem+json'));
  await assert.rejects(api('/enrollments', {}), error => {
    assert.equal(error.message, '請確認付款方式的格式與內容。；請確認課程的格式與內容。');
    return true;
  });
});

test('業務衝突保留中文訊息與打卡 code、sessionId', async () => {
  const { api } = await client(() => json({ code: 'QR_EXPIRED', message: '此 QR Code 已失效，請重新掃描課堂 QR Code。', sessionId: 27 }, 409));
  await assert.rejects(api('/check-in/sessions/27/receipt'), error => {
    assert.equal(error.status, 409);
    assert.equal(error.code, 'QR_EXPIRED');
    assert.equal(error.sessionId, 27);
    assert.match(error.message, /已失效/);
    return true;
  });
});

test('5xx 隱藏內部訊息，保留合法錯誤代碼讓打卡改為確認結果', async () => {
  const { api, calls } = await client(config => config.url === '/csrf' ? json({ token: 'ok' })
    : json({ code: 'UNKNOWN_ERROR', sessionId: 27, message: '資料庫失敗，Password=secret', detail: 'Microsoft.Data.SqlClient.SqlException' }, 503));
  await assert.rejects(api('/check-in', {}), error => {
    assert.equal(error.code, 'UNKNOWN_ERROR');
    assert.equal(error.sessionId, 27);
    assert.equal(error.status, 503);
    assert.match(error.message, /先查詢紀錄/);
    assert.doesNotMatch(error.message, /secret|SqlClient|資料庫失敗/);
    return true;
  });
  assert.equal(calls.filter(c => c.method === 'post').length, 1);
});

for (const code of ['ECONNABORTED', 'ETIMEDOUT', 'ERR_NETWORK']) {
  test(`${code} 的寫入失敗不自動重送，提示先查詢紀錄`, async () => {
    const { api, calls } = await client(config => {
      if (config.url === '/csrf') return json({ token: 'ok' });
      throw Object.assign(new Error('private stack'), { code });
    });
    await assert.rejects(api('/trial-requests', {}), error => {
      assert.equal(error.status, 0);
      assert.match(error.message, code === 'ERR_NETWORK' ? /無法連線/ : /連線逾時/);
      assert.match(error.message, /避免重複送出/);
      assert.doesNotMatch(error.message, /private/);
      return true;
    });
    assert.equal(calls.filter(c => c.method === 'post').length, 1);
  });
}

test('註冊連線結果不明時，提示先嘗試登入而不是再次註冊', async () => {
  const { api } = await client(config => {
    if (config.url === '/csrf') return json({ token: 'ok' });
    throw new Error('offline');
  });
  await assert.rejects(api('/register', {}), /先嘗試登入，避免重複註冊/);
});

for (const response of [
  { status: 200, data: '<html>Internal error: private-stack</html>', headers: { 'content-type': 'text/html' } },
  { status: 200, data: 'invalid-json', headers: { 'content-type': 'application/json' } },
  json({ id: 1 }, 200, 'text/html'), json(null), json('unexpected text'),
]) {
  test(`HTTP 200 非預期回應不算成功：${response.headers['content-type']} / ${response.data}`, async () => {
    const { api } = await client(config => config.url === '/csrf' ? json({ token: 'ok' }) : response);
    await assert.rejects(api('/check-in', {}), error => {
      assert.equal(error.status, 502);
      assert.match(error.message, /回傳格式不正確/);
      assert.match(error.message, /先查詢紀錄/);
      assert.doesNotMatch(error.message, /private-stack|invalid-json|unexpected text/);
      return true;
    });
  });
}

test('不轉送外部、跳脫與含控制字元的 API 路徑', async () => {
  const { api, calls } = await client(() => json({}));
  for (const path of ['https://attacker.invalid/steal', '//attacker.invalid/steal', '/../../outside', '/catalog\\evil', '/catalog\n', '/catalog#fragment']) {
    await assert.rejects(api(path, {}), /服務網址不正確/);
  }
  assert.equal(calls.length, 0);
});

test('日期查詢與正常編碼的查詢參數仍可使用', async () => {
  const { api } = await client(() => json([]));
  assert.deepEqual(await api('/sessions?from=2026-11-01&until=2026-11-30&name=%E7%91%9C%E7%8F%88'), []);
});

test('JSON Content-Type 依 HTTP 規則忽略標頭名稱與媒體型別大小寫', async () => {
  const { api } = await client(() => ({ status: 200, data: '{"id":1}', headers: { 'Content-Type': 'Application/JSON; charset=UTF-8' } }));
  assert.deepEqual(await api('/catalog'), { id: 1 });
});

test('驗證訊息拒絕堆疊、HTML 及不合法 payload，保留合法中文提示', () => {
  const fallback = '請稍後再試。';
  for (const payload of [null, [], 'string', { message: '內部失敗：System.Exception: secret' }, { detail: '錯誤：<script>alert(1)</script>' }, { message: '錯誤：Password=secret' }]) {
    assert.equal(portalValidationMessage(payload, fallback), fallback);
  }
  assert.equal(portalValidationMessage({ errors: { Phone: ['The value 0912 is invalid.'] } }), '請確認手機的格式與內容。');
  assert.equal(portalValidationMessage({ message: '此場次已額滿，請選擇其他場次。' }), '此場次已額滿，請選擇其他場次。');
});
