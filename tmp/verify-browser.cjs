const { chromium } = require('C:/Users/ChuanPunch/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const context = await browser.newContext({ locale: 'en-US', viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    let registrations = 0;
    const payload = '<img src=x onerror="window.xssExecuted=true">';
    const exceptions = [];
    page.on('pageerror', error => exceptions.push(error.message));
    await page.addInitScript(() => {
      window.cspViolations = [];
      document.addEventListener('securitypolicyviolation', event => window.cspViolations.push(event.violatedDirective));
    });
    // All API calls are fulfilled locally; no production writes or credentials.
    await page.route('**/api/portal/**', async route => {
      const path = new URL(route.request().url()).pathname;
      let status = 200, value;
      if (path.endsWith('/catalog')) value = { courses: [], terms: [], plans: [], locations: [{ id: 1, name: payload, address: '104臺北市中山區撫順街16號2樓' }] };
      else if (path.endsWith('/me')) { status = 401; value = { message: '請先登入會員。' }; }
      else if (path.endsWith('/csrf')) value = { token: 'isolated-browser-csrf' };
      else if (path.endsWith('/register')) { registrations++; value = { message: '學生帳號已建立。' }; }
      else if (path.endsWith('/sessions')) value = [];
      else { status = 404; value = { message: '隔離測試未提供此服務。' }; }
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
    });
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
    await page.route('https://www.google.com/maps**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Map fixture</title>' }));

    const response = await page.goto('http://127.0.0.1:4174/studio');
    assert.match(response.headers()['content-security-policy'] || '', /script-src 'self'/);
    await page.getByRole('heading', { name: payload, exact: true }).waitFor();
    assert.equal(await page.locator('.studio-details img').count(), 0);
    assert.equal(await page.evaluate(() => window.xssExecuted), undefined);
    assert.equal(await page.locator('iframe').count(), 1);
    await page.waitForTimeout(150);
    assert.deepEqual(await page.evaluate(() => window.cspViolations), []);
    await page.evaluate(() => {
      const script = document.createElement('script');
      script.textContent = 'window.inlineExecuted = true';
      document.body.append(script);
    });
    assert.equal(await page.evaluate(() => window.inlineExecuted), undefined);
    await page.waitForTimeout(100);
    assert.ok((await page.evaluate(() => window.cspViolations)).some(value => value.startsWith('script-src')));

    await page.goto('http://127.0.0.1:4174/login');
    await page.getByRole('button', { name: '第一次來？註冊學生帳號' }).click();
    await page.locator('[name=account]').fill('isolated_browser_user');
    await page.locator('[name=name]').fill('隔離測試');
    await page.locator('[name=email]').fill('isolated@example.com');
    await page.locator('[name=password]').fill('isolated-test-password');
    await page.locator('[name=confirmPassword]').fill('isolated-test-password');
    await page.locator('[name=phone]').fill('091234567');
    await page.getByRole('button', { name: '建立學生帳號', exact: true }).click();
    assert.equal(registrations, 0);
    const mobileMessage = await page.locator('[name=phone]').evaluate(input => input.validationMessage);
    assert.match(mobileMessage, /09.*10.*手機/);
    await page.locator('[name=phone]').fill('0912345678');
    await page.locator('[name=confirmPassword]').fill('different-password');
    await page.getByRole('button', { name: '建立學生帳號', exact: true }).click();
    assert.equal(registrations, 0);
    assert.match(await page.locator('[name=confirmPassword]').evaluate(input => input.validationMessage), /密碼.*不一致/);
    await page.locator('[name=confirmPassword]').fill('isolated-test-password');
    await page.getByRole('button', { name: '建立學生帳號', exact: true }).click();
    await page.getByText('學生帳號已建立，請登入。', { exact: true }).waitFor();
    assert.equal(registrations, 1);
    assert.deepEqual(await page.evaluate(() => window.cspViolations), []);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    assert.deepEqual(exceptions, []);
    console.log(JSON.stringify({ passed: true, scenarios: ['Cloudflare static CSP header', 'SPA deep link', 'XSS text escaped', 'Google iframe allowlist', 'inline script blocked', 'Chinese mobile validation in English browser', 'password mismatch', 'successful mocked registration', '390px mobile no horizontal overflow'], productionWrites: 0 }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
