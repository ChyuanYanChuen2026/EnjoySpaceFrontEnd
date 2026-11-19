import test from 'node:test';
import assert from 'node:assert/strict';
import { ESLint } from 'eslint';

const eslint = new ESLint();
const check = async source => (await eslint.lintText(source, { filePath: 'src/pages/ImportCheck.vue' }))[0].messages;

test('Vue 檢查能攔截遺漏 store 匯入，不必等到瀏覽器開頁才發現', async () => {
  const messages = await check('<script setup>const store = useCatalogStore();</script><template><p>{{ store.catalog }}</p></template>');
  assert.ok(messages.some(message => message.ruleId === 'no-undef' && message.message.includes('useCatalogStore')));
});

test('Vue 檢查能攔截樣板遺漏的工具、元件與指令', async () => {
  const messages = await check('<script setup>const value = 1;</script><template><MissingCard v-missing>{{ money(value) }}</MissingCard></template>');
  for (const ruleId of ['vue/no-undef-properties', 'vue/no-undef-components', 'vue/no-undef-directives']) {
    assert.ok(messages.some(message => message.ruleId === ruleId), ruleId);
  }
});

test('Vue 檢查接受正確匯入與 Vue Router 全域元件', async () => {
  const messages = await check("<script setup>import { useCatalogStore } from '../stores/catalog.js'; const store = useCatalogStore();</script><template><RouterLink to='/courses'>{{ store.catalog.courses.length }}</RouterLink><RouterView /></template>");
  assert.deepEqual(messages, []);
});
