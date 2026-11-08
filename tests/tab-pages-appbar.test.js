const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const app = JSON.parse(read('app.json'));

// 所有 tab 页都使用自定义头部：原生导航栏在 tab 间显示/隐藏会导致切换时整页闪动。
for (const { pagePath } of app.tabBar.list) {
  const config = JSON.parse(read(`${pagePath}.json`));
  assert.equal(config.navigationStyle, 'custom', `${pagePath} 必须使用自定义导航`);
}

// 深色头部的页面状态栏文字必须为白色。
for (const page of ['pages/favorites/favorites', 'pages/orders/orders', 'pages/profile/profile']) {
  assert.equal(JSON.parse(read(`${page}.json`)).navigationBarTextStyle, 'white', page);
}

for (const [page, title] of [['pages/favorites/favorites', '我的收藏'], ['pages/profile/profile', '我的']]) {
  const config = JSON.parse(read(`${page}.json`));
  assert.equal(config.usingComponents['tab-appbar'], '/components/tab-appbar/tab-appbar');
  assert.ok(read(`${page}.wxml`).startsWith(`<tab-appbar title="${title}" />`));
  if (config.enablePullDownRefresh) assert.equal(config.backgroundColorTop, '#2B2726', `${page} 下拉区域与头部同色`);
}

// 公共头部与订单页头部视觉一致，并在首次渲染时就带上正确高度。
const appbarStyles = read('components/tab-appbar/tab-appbar.wxss');
const orderStyles = read('pages/orders/orders.wxss');
const rule = (styles, selector) => styles.match(new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`))[1];
for (const prop of ['position: fixed', 'background: #2B2726', 'padding: 0 28rpx']) {
  assert.ok(rule(appbarStyles, '.tab-appbar').includes(prop) && rule(orderStyles, '.orders-appbar').includes(prop), prop);
}
assert.equal(rule(appbarStyles, '.tab-appbar-title').trim(), rule(orderStyles, '.orders-title').trim());

let definition;
global.Component = (options) => { definition = options; };
global.wx = {
  getWindowInfo: () => ({ windowWidth: 375, statusBarHeight: 47 }),
  getMenuButtonBoundingClientRect: () => ({ top: 51, height: 32, width: 87, left: 281 })
};
require('../components/tab-appbar/tab-appbar');
assert.equal(definition.data.statusBarHeight, 47);
assert.equal(definition.data.appBarHeight, 47 + 32 + 8);
delete global.Component;
delete global.wx;
