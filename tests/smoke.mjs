import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const html = read('index.html');
const js = read('app.js');
const css = read('styles.css');
const sw = read('sw.js');
const data = JSON.parse(read('data.json'));

assert.match(html, /<link rel="stylesheet" href="styles\.css">/);
assert.match(html, /<script src="app\.js" defer><\/script>/);
assert.ok(css.length > 10_000, 'restored stylesheet is unexpectedly small');
assert.ok(js.length > 50_000, 'restored application logic is unexpectedly small');
assert.doesNotThrow(() => new Function(js), 'app.js must parse as JavaScript');

for (const id of ['main', 'chips', 'hdate', 'fdate', 'toast', 'histList', 'histModal', 'spModal', 'bandModal']) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `missing critical element #${id}`);
}

for (const key of ['fresh', 'recent', 'alter', 'main', 'future', 'news', 'buzz', 'pt', 'mc', 'rev', 'dt', 'st']) {
  assert.ok(Array.isArray(data[key]), `data.${key} must be an array`);
}
assert.ok(data.future.every(day => day && Array.isArray(day.items)), 'future entries require item arrays');
assert.ok(data.future.reduce((total, day) => total + day.items.length, 0) > 0, 'future timeline must contain releases');

assert.match(js, /function safeUrl\(/);
assert.match(js, /function normalizeData\(/);
assert.match(js, /md_spstate/);
assert.match(js, /md_tdstate/);
assert.doesNotMatch(js, /state:'(?:pl|fresh|tpl)'/);
assert.match(sw, /'\.\/styles\.css'/);
assert.match(sw, /'\.\/app\.js'/);

console.log('Metal Daily smoke checks passed.');
