import test from 'node:test'
import assert from 'node:assert/strict'

test('API shows validation errors and refreshes CSRF after rejected form', async () => {
  const { api } = await import('../src/api.js?validation')
  const original = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push([url, options])
    if (url.endsWith('/csrf')) return Response.json({ token: 'fresh-' + calls.length })
    if (calls.length === 2) return Response.json({ errors: { Email: ['請輸入有效 Email'] } }, { status: 400 })
    return Response.json({ id: 1 })
  }
  try {
    await assert.rejects(api('/trial-requests', {}), /請輸入有效 Email/)
    await api('/trial-requests', {})
    assert.equal(calls.filter(([url]) => url.endsWith('/csrf')).length, 2)
    assert.equal(calls[3][1].headers['X-CSRF-TOKEN'], 'fresh-3')
  } finally { globalThis.fetch = original }
})

test('API handles an HTML proxy response without exposing parsing errors', async () => {
  const { api } = await import('../src/api.js?html')
  const original = globalThis.fetch
  globalThis.fetch = async () => new Response('<html>proxy error</html>')
  try { await assert.rejects(api('/catalog'), /伺服器回傳格式不正確/) }
  finally { globalThis.fetch = original }
})

test('API does not display server diagnostic details', async () => {
  const { api } = await import('../src/api.js?server')
  const original = globalThis.fetch
  globalThis.fetch = async () => Response.json({ detail: 'sensitive database trace' }, { status: 500 })
  try { await assert.rejects(api('/catalog'), /目前無法取得工作室資料/) }
  finally { globalThis.fetch = original }
})
