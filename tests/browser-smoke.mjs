import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'], ['.json', 'application/json; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json'], ['.png', 'image/png'],
]);

const server = http.createServer((request, response) => {
  const relative = request.url === '/' ? 'index.html' : decodeURIComponent(request.url.split('?')[0]).replace(/^\/+/, '');
  const target = path.resolve(root, relative);
  if (!target.startsWith(root + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
    response.writeHead(404).end('Not found');
    return;
  }
  response.writeHead(200, { 'Content-Type': types.get(path.extname(target)) || 'application/octet-stream' });
  fs.createReadStream(target).pipe(response);
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_EXECUTABLE || undefined,
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));

try {
  await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelectorAll('.folder').length >= 10);
  assert.equal(await page.title(), 'Now Playing');
  assert.ok((await page.locator('.folder').count()) >= 10, 'home folders did not render');
  assert.match(await page.locator('#hdate').innerText(), /Atualizado/i);
  await page.locator('.folder').first().click();
  await page.waitForFunction(() => document.querySelectorAll('.card').length > 0);
  assert.ok((await page.locator('.card').count()) > 0, 'release cards did not render');
  assert.deepEqual(pageErrors, [], `browser errors: ${pageErrors.join('; ')}`);
  console.log('Metal Daily browser smoke checks passed.');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
