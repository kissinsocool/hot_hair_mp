const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api', mediaBaseUrl: '' } });
global.wx = { getStorageSync: () => null };
const orders = require('../utils/orders');

const root = path.join(__dirname, '..');
function templateFields(file, start = 0, end) {
  const text = fs.readFileSync(path.join(root, file), 'utf8').slice(start, end);
  return [...new Set([...text.matchAll(/item\.([A-Za-z]+)/g)].map((m) => m[1]))];
}

// 模板用到的字段都在白名单里：模板新增字段时必须同步，否则视图层拿不到。
for (const field of templateFields('pages/orders/orders.wxml')) {
  assert.ok(orders.ORDER_CARD_FIELDS.includes(field), `orders: ${field}`);
}
for (const field of templateFields('pages/messages/messages.wxml')) {
  assert.ok(orders.MESSAGE_FIELDS.includes(field), `messages: ${field}`);
}
const profileTemplate = fs.readFileSync(path.join(root, 'pages/profile/profile.wxml'), 'utf8');
const reviewStart = profileTemplate.indexOf('wx:for="{{reviews}}"');
const profileSource = fs.readFileSync(path.join(root, 'pages/profile/profile.js'), 'utf8');
const reviewFields = profileSource.match(/REVIEW_CARD_FIELDS = \[([\s\S]*?)\]/)[1];
for (const field of templateFields('pages/profile/profile.wxml', reviewStart)) {
  assert.ok(reviewFields.includes(`'${field}'`), `profile reviews: ${field}`);
}

// 视图数据只含白名单字段，完整订单的其他字段不进入 setData；缺失字段不以 undefined 传入。
const view = orders.orderCardView(orders.formatOrder({
  id: 'b1', status: 'completed', startTime: '2030-01-01T10:00:00', salonId: 's1', serviceId: 'v1',
  salonName: '店', serviceName: '剪发', internalNote: 'x', complaint: null
}));
assert.ok(Object.keys(view).every((key) => orders.ORDER_CARD_FIELDS.includes(key)));
assert.ok(!('salonId' in view) && !('internalNote' in view));
assert.ok(Object.values(view).every((value) => value !== undefined));
assert.equal(view.canRebook, true);
