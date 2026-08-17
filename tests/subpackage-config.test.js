const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));

assert(!app.pages.includes('pages/ad/ad'));
assert(!app.pages.includes('pages/rules/user-agreement'));
assert(!app.pages.includes('pages/rules/privacy-policy'));
assert.deepEqual(app.subPackages, [
  { root: 'pages/ad', pages: ['ad'] },
  { root: 'pages/rules', pages: ['user-agreement', 'privacy-policy'] }
]);

for (const image of ['hush-cut.jpg', 'build-perm.jpg', 'guile-cut.jpg']) {
  assert(fs.existsSync(path.join(root, 'pages/ad/images', image)));
}
