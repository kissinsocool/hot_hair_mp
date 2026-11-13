const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const config = (page) => JSON.parse(read(`${page}.json`));

// 切 tab 时，新页面画出首帧前会露出一帧空白；画在页面里的顶部栏会跟着消失。
// 只有标题的 tab 页使用原生导航栏，空白帧期间顶栏保持不动。
for (const [page, title] of [['pages/favorites/favorites', '我的收藏'], ['pages/profile/profile', '我的']]) {
  const pageConfig = config(page);
  assert.notEqual(pageConfig.navigationStyle, 'custom', `${page} 必须使用原生导航栏`);
  assert.equal(pageConfig.navigationBarTitleText, title);
  assert.equal(pageConfig.navigationBarBackgroundColor, '#ffffff');
  assert.equal(pageConfig.navigationBarTextStyle, 'black');
  if (pageConfig.enablePullDownRefresh) assert.equal(pageConfig.backgroundColorTop, pageConfig.navigationBarBackgroundColor, `${page} 下拉区域与导航栏同色`);
}

// 顶部带定位、搜索或消息入口的 tab 页放不进原生导航栏，保留自定义头部。
assert.equal(config('pages/home/home').navigationStyle, 'custom');
const orders = config('pages/orders/orders');
assert.equal(orders.navigationStyle, 'custom');
assert.equal(orders.navigationBarTextStyle, config('pages/home/home').navigationBarTextStyle, '订单页状态栏文字颜色与首页一致');
