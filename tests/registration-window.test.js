import test from 'node:test';
import assert from 'node:assert/strict';
import { registrationWindowReason } from '../src/registrationWindow.js';

const details = { registrationStartAtUtc: '2030-01-01T02:00:00Z', registrationEndAtUtc: '2030-01-02T02:00:00Z' };
test('報名時間以 UTC 判斷，開始包含、截止不包含', () => {
  assert.match(registrationWindowReason(details, Date.parse('2030-01-01T09:59:59+08:00')), /尚未到/);
  assert.equal(registrationWindowReason(details, Date.parse('2030-01-01T10:00:00+08:00')), '');
  assert.equal(registrationWindowReason(details, Date.parse('2030-01-02T09:59:59+08:00')), '');
  assert.match(registrationWindowReason(details, Date.parse('2030-01-02T10:00:00+08:00')), /截止/);
});
test('未設定與單邊時間維持既有選填語意', () => {
  assert.equal(registrationWindowReason(null), '');
  assert.equal(registrationWindowReason({ registrationStartAtUtc: null, registrationEndAtUtc: null }), '');
  assert.match(registrationWindowReason({ registrationEndAtUtc: details.registrationEndAtUtc }, Date.parse('2031-01-01Z')), /截止/);
  assert.match(registrationWindowReason({ registrationStartAtUtc: details.registrationStartAtUtc }, Date.parse('2029-01-01Z')), /尚未到/);
});
test('即使先前 API 說可報名，停留頁面跨過截止時間也必須阻擋', () => {
  const stale = { ...details, canEnroll: true };
  assert.equal(registrationWindowReason(stale, Date.parse(details.registrationEndAtUtc) - 1), '');
  assert.match(registrationWindowReason(stale, Date.parse(details.registrationEndAtUtc)), /截止/);
});
