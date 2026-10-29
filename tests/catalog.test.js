import test from 'node:test'
import assert from 'node:assert/strict'
import { apiClient, money, validity, audience, calendarDate } from '../src/api.js'

test('display values use whole currency amounts and preserve validity and audience labels', () => {
  assert.equal(money(2468.75), '2,469')
  assert.equal(money(321), '321')
  assert.equal(validity({ validityUnit: 'Unlimited' }), '不限期')
  assert.equal(validity({ validityUnit: 'Days', validityValue: 30 }), '30 天（含生效日）')
  assert.equal(validity({ validityText: '4 個月', validityUnit: 'Months', validityValue: 4 }), '4 個月')
  assert.equal(audience({ audienceText: '正式學生' }), '正式學生')
  assert.equal(calendarDate('2026-10-01'), '2026/10/01')
})

test('catalog refresh replaces old API data and coalesces simultaneous reads', async () => {
  const { catalog, loadCatalog, catalogRevision } = await import('../src/state.js')
  const original = apiClient.defaults.adapter
  let requests = 0
  apiClient.defaults.adapter = async config => {
    assert.equal(config.baseURL, '/api/portal')
    assert.equal(config.url, '/catalog')
    assert.equal(config.headers.get('Cache-Control'), 'no-cache')
    requests++
    return { config, status: 200, statusText: 'OK', headers: {}, data: JSON.stringify({ courses: [{ id: 1, name: '後台課程', termPrice: requests === 1 ? 300 : 500 }], plans: [], locations: [], terms: [] }) }
  }
  try {
    await Promise.all([loadCatalog(), loadCatalog()])
    assert.equal(requests, 1)
    assert.equal(catalog.value.courses[0].termPrice, 300)
    await loadCatalog()
    assert.equal(requests, 2)
    assert.equal(catalog.value.courses[0].termPrice, 500)
    assert.equal(catalogRevision.value, 2)
  } finally { apiClient.defaults.adapter = original }
})
