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
assert(!app.pages.includes('pages/coupon-gift/coupon-gift'));
// 低频页面各自独立分包，root 就是原页面目录，页面路径、分享链接和跳转地址都不变。
const SINGLE_PAGE_PACKAGES = ['salon-posts', 'salon-reviews', 'style-gallery', 'order-detail', 'review-editor', 'account', 'support', 'location'];
assert.deepEqual(app.subPackages, [
  { root: 'pages/coupon-gift', pages: ['coupon-gift'] },
  { root: 'pages/web', pages: ['web'] },
  { root: 'pages/rules', pages: ['user-agreement', 'privacy-policy'] },
  ...SINGLE_PAGE_PACKAGES.map((name) => ({ root: `pages/${name}`, pages: [name] }))
]);
for (const name of SINGLE_PAGE_PACKAGES) assert(!app.pages.includes(`pages/${name}/${name}`), name);
// tabBar 页和预约主流程留在主包。
for (const page of ['home', 'favorites', 'orders', 'profile', 'login', 'detail', 'booking', 'confirm']) {
  assert(app.pages.includes(`pages/${page}/${page}`), page);
}
// 预下载规则只引用存在的分包，触发页面都在主包。
const roots = new Set(app.subPackages.map((item) => item.root));
for (const [page, rule] of Object.entries(app.preloadRule)) {
  assert(app.pages.includes(page), page);
  rule.packages.forEach((root) => assert(roots.has(root), root));
}
// 分包页面只能引用主包或自己目录里的文件。
for (const name of SINGLE_PAGE_PACKAGES) {
  const js = fs.readFileSync(path.join(root, `pages/${name}/${name}.js`), 'utf8');
  for (const [, target] of js.matchAll(/require\('([^']+)'\)/g)) {
    const resolved = path.relative(root, path.resolve(root, `pages/${name}`, target));
    assert(!resolved.startsWith('pages/') || resolved.startsWith(`pages/${name}/`), `${name} -> ${target}`);
  }
}

for (const extension of ['js', 'json', 'wxml']) {
  assert(fs.existsSync(path.join(root, 'pages/web', `web.${extension}`)));
}

const project = JSON.parse(fs.readFileSync(path.join(root, 'project.config.json'), 'utf8'));
// The IDE analyzer can drop imported stylesheets from debug packages.
for (const stylesheet of ['styles/service-card.wxss', 'styles/featured-badge.wxss']) {
  assert(project.packOptions.include.some(item => (
    item.type === 'file' && item.value === stylesheet
  )), `${stylesheet} must be included in the mini program package`);
  assert(fs.existsSync(path.join(root, stylesheet)));
}
