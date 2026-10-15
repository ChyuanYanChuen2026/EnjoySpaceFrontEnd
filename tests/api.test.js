import test from 'node:test'
import assert from 'node:assert/strict'

const reply = (config, data, status = 200) => ({ config, data: JSON.stringify(data), status, statusText: '', headers: {} })

test('Axios sends JSON and CSRF, then refreshes the token after a rejected form', async () => {
  const { api, apiClient } = await import('../src/api.js?validation')
  const calls = []
  apiClient.defaults.adapter = async config => {
    calls.push(config)
    assert.equal(config.baseURL, '/api/portal')
    assert.equal(config.withCredentials, true)
    if (config.url === '/csrf') return reply(config, { token: 'fresh-' + calls.length })
    if (calls.length === 2) return reply(config, { errors: { Email: ['請輸入有效 Email'] } }, 400)
    return reply(config, { id: 1 })
  }
  await assert.rejects(api('/trial-requests', { name: '會員' }), /請輸入有效 Email/)
  assert.deepEqual(await api('/trial-requests', { name: '會員' }), { id: 1 })
  assert.equal(calls.filter(c => c.url === '/csrf').length, 2)
  assert.equal(calls[3].headers.get('X-CSRF-TOKEN'), 'fresh-3')
  assert.equal(calls[3].headers.get('Content-Type'), 'application/json')
  assert.equal(calls[3].method, 'post')
  assert.deepEqual(JSON.parse(calls[3].data), { name: '會員' })
})

test('API handles an HTML proxy response without exposing parsing errors', async () => {
  const { api, apiClient } = await import('../src/api.js?html')
  apiClient.defaults.adapter = async config => ({ ...reply(config, null), data: '<html>proxy error</html>' })
  await assert.rejects(api('/catalog'), /伺服器回傳格式不正確/)
})

test('API does not display server diagnostic details', async () => {
  const { api, apiClient } = await import('../src/api.js?server')
  apiClient.defaults.adapter = async config => reply(config, { detail: 'sensitive database trace' }, 500)
  await assert.rejects(api('/catalog'), /目前無法取得工作室資料/)
})

test('login and 204 logout invalidate the CSRF token before the next write', async () => {
  const { api, apiClient } = await import('../src/api.js?authentication')
  let tokens = 0
  const writes = []
  apiClient.defaults.adapter = async config => {
    if (config.url === '/csrf') return reply(config, { token: String(++tokens) })
    writes.push(config.headers.get('X-CSRF-TOKEN'))
    if (config.url === '/logout') return { ...reply(config, null, 204), data: '' }
    return reply(config, { ok: true })
  }
  await api('/login', { account: 'student', password: 'test-only' })
  assert.equal(await api('/logout', {}), undefined)
  await api('/register', {})
  assert.deepEqual(writes, ['1', '2', '3'])
})

test('HTTP status errors remain typed and network failures have a useful message', async () => {
  const { api, apiClient, ApiError } = await import('../src/api.js?errors')
  for (const [status, message] of [[401, '請先登入會員。'], [403, '此帳號沒有使用此功能的權限。'], [429, '操作較頻繁，請稍候一分鐘再試。']]) {
    apiClient.defaults.adapter = async config => reply(config, {}, status)
    await assert.rejects(api('/dashboard'), e => e instanceof ApiError && e.status === status && e.message === message)
  }
  apiClient.defaults.adapter = async () => { throw new Error('network details') }
  await assert.rejects(api('/catalog'), e => e instanceof ApiError && e.status === 0 && e.message === '目前無法連線，請稍後再試。')
})
