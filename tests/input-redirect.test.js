import test from 'node:test';
import assert from 'node:assert/strict';
import { safeRedirect } from '../src/safeRedirect.js';

test('保留課程、會員、體驗與打卡的站內目的地和查詢／片段', () => {
  for (const path of ['/member', '/member/courses?course=12', '/member/makeup?request=3',
    '/member/enrollments?application=4', '/member/trials', '/member/profile', '/trial?session=1&plan=2',
    '/check-in?token=abc%2Bdef%2Fghi%3D', '/courses/12/enroll#details', '/', '/schedule']) {
    assert.equal(safeRedirect(path), path);
  }
});

test('拒絕外站、協定相對、反斜線、控制字元、陣列與未知路由', () => {
  for (const target of [undefined, null, ['/member', 'https://evil.test'], {}, '', 'https://evil.test',
    '//evil.test', '/\\evil.test', '\\evil.test', '/member\n', '/\tevil.test',
    'javascript:alert(1)', '/api/portal/logout', '/login?redirect=/login', '/unknown',
    '/%2f%2fevil.test', '/member/%2e%2e/unknown']) {
    assert.equal(safeRedirect(target), '/member', JSON.stringify(target));
  }
});

test('正規化仍留在同站已知頁面，不能利用路徑穿越到 API', () => {
  assert.equal(safeRedirect('/courses/../member?from=trial'), '/member?from=trial');
  assert.equal(safeRedirect('/member/../api/portal/logout'), '/member');
});
