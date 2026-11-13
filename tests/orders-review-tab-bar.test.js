const assert = require('node:assert/strict');
let definition;
const navigations = [];
global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api' } });
global.Page = value => { definition = value; };
global.wx = {
  getStorageSync: () => ({ token: 'token', user: {} }),
  navigateTo(options) { navigations.push(options); }
};
require('../pages/orders/orders');
const order = { id: 'booking-1', reviewed: false, complained: false };
const page = { ...definition, data: { ...definition.data, orders: [{ id: order.id }] }, orderSources: new Map([[order.id, order]]),
  setData(values) { Object.assign(this.data, values); },
  getTabBar: () => ({ show() {}, hide() { assert.fail('a separate editor must not hide the source tab bar'); } }) };
for (const mode of ['review', 'complaint']) {
  page.review({ currentTarget: { dataset: { id: order.id, type: mode } } });
  const navigation = navigations.at(-1);
  assert.equal(navigation.url, '/pages/review-editor/review-editor');
  navigation.success({ eventChannel: { emit(event, data) {
    assert.equal(event, 'init'); assert.deepEqual(data, { mode, booking: order });
  } } });
}
order.reviewed = true;
order.complained = true;
page.review({ currentTarget: { dataset: { id: order.id, type: 'review' } } });
page.review({ currentTarget: { dataset: { id: order.id, type: 'complaint' } } });
assert.equal(navigations.length, 2, 'already submitted entries must remain blocked');
delete global.Page; delete global.wx; delete global.getApp;
