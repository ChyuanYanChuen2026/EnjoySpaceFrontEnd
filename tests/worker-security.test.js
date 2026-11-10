import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { handleRequest } from '../worker/index.js';

const env = {
  API_ORIGIN: 'https://backend.example.com',
  ASSETS: { fetch: async () => new Response('static page') },
};
const request = (path = '/api/portal/catalog', options) => new Request(`https://twtpenjoyspace.com${path}`, options);
const json = (value, options = {}) => new Response(JSON.stringify(value), {
  ...options, headers: { 'Content-Type': 'application/json; charset=utf-8', ...options.headers },
});

function assertApiHeaders(response) {
  assert.equal(response.headers.get('Cache-Control'), 'no-store, private');
  assert.equal(response.headers.get('CDN-Cache-Control'), 'no-store');
  assert.equal(response.headers.get('Cloudflare-CDN-Cache-Control'), 'no-store');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.match(response.headers.get('Content-Security-Policy'), /default-src 'none'/);
  assert.match(response.headers.get('Content-Security-Policy'), /frame-ancestors 'none'/);
  assert.equal(response.headers.get('X-Frame-Options'), 'DENY');
}

test('only API paths use the upstream proxy', async () => {
  const response = await handleRequest(request('/member/trials'), env, () => assert.fail('must serve assets'));
  assert.equal(await response.text(), 'static page');
});

test('proxy preserves cookies and CSRF but removes spoofed forwarded headers', async () => {
  const cookies = ['session=first; HttpOnly; Secure; Path=/', 'csrf=second; Secure; Path=/'];
  const upstreamHeaders = new Headers({ 'Content-Type': 'application/json', Server: 'internal', 'X-Powered-By': 'ASP.NET' });
  cookies.forEach(cookie => upstreamHeaders.append('Set-Cookie', cookie));
  const response = await handleRequest(request('/api/portal/login', {
    method: 'POST', headers: { Cookie: 'session=existing', 'X-CSRF-TOKEN': 'test-token', 'X-Forwarded-For': '10.0.0.1', Forwarded: 'host=evil.test' }, body: '{}',
  }), env, async (url, options) => {
    assert.equal(url, 'https://backend.example.com/api/portal/login');
    assert.equal(options.redirect, 'manual');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.headers.get('Cookie'), 'session=existing');
    assert.equal(options.headers.get('X-CSRF-TOKEN'), 'test-token');
    assert.equal(options.headers.has('X-Forwarded-For'), false);
    assert.equal(options.headers.has('Forwarded'), false);
    return new Response('{}', { headers: upstreamHeaders });
  });
  assert.equal(response.status, 200);
  assert.deepEqual(response.headers.getSetCookie(), cookies);
  assert.equal(response.headers.has('Server'), false);
  assert.equal(response.headers.has('X-Powered-By'), false);
  assertApiHeaders(response);
});

test('HTML success pages become Chinese JSON errors, never same-origin HTML', async () => {
  const response = await handleRequest(request(), env, async () => new Response('<script>alert(1)</script>', { headers: { 'Content-Type': 'text/html' } }));
  assert.equal(response.status, 502);
  assert.match(response.headers.get('Content-Type'), /application\/json/);
  assert.doesNotMatch(await response.text(), /<script>|alert/);
  assertApiHeaders(response);
});

for (const status of [400, 401, 403, 404, 429]) {
  test(`non-JSON ${status} keeps its status without exposing its body`, async () => {
    const response = await handleRequest(request(), env, async () => new Response('private diagnostic', { status, headers: { 'Content-Type': 'text/html', 'Retry-After': '60' } }));
    assert.equal(response.status, status);
    assert.doesNotMatch(await response.text(), /private diagnostic/);
    assert.equal(response.headers.get('Retry-After'), '60');
    assertApiHeaders(response);
  });
}

for (const status of [302, 307, 500, 503]) {
  test(`upstream ${status} is not followed or exposed`, async () => {
    let calls = 0;
    const response = await handleRequest(request(), env, async () => { calls++; return json({ message: 'internal credentials' }, { status, headers: { Location: 'https://evil.test' } }); });
    assert.equal(calls, 1);
    assert.equal(response.status, 502);
    assert.doesNotMatch(await response.text(), /credentials|evil/);
    assertApiHeaders(response);
  });
}

test('JSON ProblemDetails and 204 remain supported', async () => {
  const problem = await handleRequest(request(), env, async () => json({ errors: { Phone: ['手機格式不正確。'] } }, { status: 400, headers: { 'Content-Type': 'application/problem+json' } }));
  assert.equal(problem.status, 400);
  assert.deepEqual((await problem.json()).errors.Phone, ['手機格式不正確。']);
  const empty = await handleRequest(request(), env, async () => new Response(null, { status: 204 }));
  assert.equal(empty.status, 204);
  assertApiHeaders(empty);
});

test('a normalized HTML 401 preserves all cookie removal headers', async () => {
  const cookies = ['session=; Max-Age=0; Path=/; HttpOnly; Secure', 'csrf=; Max-Age=0; Path=/; Secure'];
  const headers = new Headers({ 'Content-Type': 'text/html' });
  cookies.forEach(cookie => headers.append('Set-Cookie', cookie));
  const response = await handleRequest(request(), env, async () => new Response('internal login page', { status: 401, headers }));
  assert.equal(response.status, 401);
  assert.deepEqual(response.headers.getSetCookie(), cookies);
  assert.doesNotMatch(await response.text(), /internal login/);
});

test('unsafe origins, arbitrary paths and unsupported methods never reach upstream', async () => {
  for (const origin of ['', 'http://backend.example.com', 'https://127.0.0.1', 'https://user:password@backend.example.com', 'https://backend.example.com/api', 'https://twtpenjoyspace.com']) {
    const response = await handleRequest(request(), { ...env, API_ORIGIN: origin }, () => assert.fail('must reject origin'));
    assert.equal(response.status, 503);
    assertApiHeaders(response);
  }
  for (const path of ['/api/admin', '/api/portal/%2fadmin', '/api/portal/%252fadmin', '/API/portal/catalog']) {
    const response = await handleRequest(request(path), env, () => assert.fail('must reject path'));
    assert.equal(response.status, 404);
  }
  const response = await handleRequest(request('/api/portal/catalog', { method: 'DELETE' }), env, () => assert.fail('must reject method'));
  assert.equal(response.status, 405);
});

test('network failure produces safe JSON and is never retried', async () => {
  let calls = 0;
  const response = await handleRequest(request(), env, async () => { calls++; throw new Error('private upstream address'); });
  assert.equal(calls, 1);
  assert.equal(response.status, 502);
  assert.doesNotMatch(await response.text(), /private upstream/);
  assertApiHeaders(response);
});

test('static CSP allows only required sources and forbids inline script / eval', async () => {
  const headers = await readFile(new URL('../public/_headers', import.meta.url), 'utf8');
  assert.match(headers, /script-src 'self';/);
  assert.match(headers, /connect-src 'self';/);
  assert.match(headers, /frame-src https:\/\/www\.google\.com;/);
  assert.match(headers, /style-src 'self' https:\/\/fonts\.googleapis\.com;/);
  assert.match(headers, /font-src 'self' https:\/\/fonts\.gstatic\.com;/);
  assert.match(headers, /frame-ancestors 'none'/);
  assert.doesNotMatch(headers, /unsafe-inline|unsafe-eval|\*\./);
});
