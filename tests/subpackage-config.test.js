const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));

assert.equal(app.lazyCodeLoading, 'requiredComponents');
assert.deepEqual(app.requiredPrivateInfos, ['getFuzzyLocation', 'chooseLocation']);
assert.equal(app.permission['scope.userFuzzyLocation'].desc, '你的模糊位置将用于推荐附近美发店');
assert.equal(app.permission['scope.userLocation'].desc, '你选择的位置将用于推荐附近美发店');
assert(!app.pages.includes('pages/ad/ad'));
assert(!app.pages.includes('pages/rules/user-agreement'));
assert(!app.pages.includes('pages/rules/privacy-policy'));
assert.deepEqual(app.subPackages, [
  { root: 'pages/web', pages: ['web'] },
  { root: 'pages/rules', pages: ['user-agreement', 'privacy-policy'] }
]);

for (const extension of ['js', 'json', 'wxml']) {
  assert(fs.existsSync(path.join(root, 'pages/web', `web.${extension}`)));
}
