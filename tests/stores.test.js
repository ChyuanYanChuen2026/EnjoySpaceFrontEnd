import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createPinia } from 'pinia';
import { useCatalogStore } from '../src/stores/catalog.js';
import { useMemberStore } from '../src/stores/member.js';
import { useTrialStore } from '../src/stores/trial.js';
import { apiClient } from '../src/services/api.js';

const originalAdapter = apiClient.defaults.adapter;
afterEach(() => { apiClient.defaults.adapter = originalAdapter; });
const response = payload => ({ status: 200, data: JSON.stringify(payload), headers: { 'content-type': 'application/json' } });

test('同一 Pinia 跨頁共用狀態，不同應用的會員與草稿互不污染', () => {
  const first = createPinia(), second = createPinia();
  useMemberStore(first).member = { displayName: '學生', roles: ['Student'] };
  useTrialStore(first).trialDraft = { planId: 3 };
  assert.equal(useMemberStore(first).member.displayName, '學生');
  assert.deepEqual(useTrialStore(first).trialDraft, { planId: 3 });
  assert.equal(useMemberStore(second).member, null);
  assert.equal(useTrialStore(second).trialDraft, null);
});

test('同時載入目錄只發一次請求，成功後更新版本與時間', async () => {
  const store = useCatalogStore(createPinia());
  let complete, calls = 0;
  apiClient.defaults.adapter = () => { calls++; return new Promise(resolve => { complete = resolve; }); };
  const first = store.loadCatalog(), second = store.loadCatalog();
  assert.equal(store.loading, true);
  assert.equal(calls, 1);
  complete(response({ courses: [{ id: 1 }], plans: [], locations: [], terms: [] }));
  await Promise.all([first, second]);
  assert.equal(store.catalog.courses[0].id, 1);
  assert.equal(store.catalogRevision, 1);
  assert.ok(store.refreshedAt instanceof Date);
  assert.equal(store.loading, false);
});

test('目錄讀取失敗保留舊資料，解除載入鎖後可以重試', async () => {
  const store = useCatalogStore(createPinia());
  store.catalog.courses = [{ id: 7 }];
  apiClient.defaults.adapter = async () => { throw new Error('offline'); };
  await store.loadCatalog();
  assert.equal(store.catalog.courses[0].id, 7);
  assert.equal(store.loading, false);
  assert.ok(store.loadError);
  assert.equal(store.catalogRevision, 0);
  apiClient.defaults.adapter = async () => response({ courses: [], plans: [], locations: [], terms: [] });
  await store.loadCatalog();
  assert.equal(store.loadError, '');
  assert.equal(store.catalogRevision, 1);
});
