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
  { root: 'pages/ad', pages: ['ad'] },
  { root: 'pages/rules', pages: ['user-agreement', 'privacy-policy'] }
]);

for (const image of ['hush-cut.jpg', 'build-perm.jpg', 'guile-cut.jpg']) {
  const imagePath = path.join(root, 'pages/ad/images', image);
  assert(fs.existsSync(imagePath));
  assert(fs.statSync(imagePath).size <= 200_000, `${image} must not exceed 200 KB`);
}
