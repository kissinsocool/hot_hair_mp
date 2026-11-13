const assert = require('node:assert/strict');
const { test } = require('node:test');

test('post service view matches current salon services and only marks known removals as unavailable', () => {
  const { postServiceView } = require('../utils/postService');
  const services = [{ id: 'svc', name: '剪发', note: ' 洗护\r\n造型 ', tagIds: ['wash_cut_blow'], priceFen: 100, discountTenths: 80, originalPriceFen: 125 }];
  assert.deepEqual(postServiceView({ serviceId: 'svc', serviceName: '旧名' }, services), {
    serviceName: '旧名',
    serviceUnavailable: false,
    relatedService: { id: 'svc', name: '剪发', tags: ['洗剪吹'], noteText: '洗护，造型', priceFen: 100, discountTenths: 80, originalPriceFen: 125 }
  });
  assert.deepEqual(postServiceView({ serviceId: 'gone', serviceName: '旧套餐' }, services), { serviceName: '旧套餐', serviceUnavailable: true, relatedService: null });
  // 套餐列表没取到时无法判断是否下架，只展示名称。
  assert.deepEqual(postServiceView({ serviceId: 'svc', serviceName: '剪发' }, null), { serviceName: '剪发', serviceUnavailable: false, relatedService: null });
  assert.deepEqual(postServiceView({}, services), { serviceName: '', serviceUnavailable: false, relatedService: null });
});

test('post service card books the related service after login', () => {
  let definition;
  const navigations = [];
  global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api' } });
  global.Component = (component) => { definition = component; };
  global.wx = { navigateTo: (options) => navigations.push(options), getStorageSync: () => null };
  const api = require('../utils/api');
  const original = api.requireLogin;
  let loggedIn = false;
  api.requireLogin = () => loggedIn;
  try {
    require('../components/post-service-card/post-service-card');
    const card = { data: { salonId: 'salon/1', service: { id: 'svc 1' } }, ...definition.methods };
    card.book();
    assert.deepEqual(navigations, []);
    loggedIn = true;
    card.book();
    assert.deepEqual(navigations, [{ url: '/pages/booking/booking?id=salon%2F1&serviceId=svc%201' }]);
  } finally {
    api.requireLogin = original;
    delete global.getApp;
    delete global.Component;
    delete global.wx;
  }
});

test('compact post service card shows name and note on the left and the pink price on the right', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const template = fs.readFileSync(path.join(__dirname, '../components/post-service-card/post-service-card.wxml'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '../components/post-service-card/post-service-card.wxss'), 'utf8');
  const compact = template.slice(0, template.indexOf('wx:elif="{{service}}"'));
  assert.match(compact, /wx:if="\{\{service && compact\}\}"/);
  assert.doesNotMatch(compact, /post-service-label|关<\/text>/, '紧凑模式不显示左侧关联套餐标签');
  assert.ok(compact.indexOf('post-service-compact-name') < compact.indexOf('post-service-compact-note'));
  assert.ok(compact.indexOf('post-service-compact-main') < compact.indexOf('post-service-compact-price'));
  assert.match(styles, /\.post-service-compact-amount\s*\{[^}]*color:\s*#d06884;/s);

  let definition;
  global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api' } });
  global.Component = (component) => { definition = component; };
  global.wx = { getStorageSync: () => null };
  try {
    delete require.cache[require.resolve('../components/post-service-card/post-service-card')];
    require('../components/post-service-card/post-service-card');
    const card = { data: {}, setData(values) { Object.assign(this.data, values); } };
    definition.observers.service.call(card, { priceFen: 1672000, discountTenths: 80, originalPriceFen: 2090000 });
    assert.deepEqual(card.data, { priceText: '¥16,720', originalPriceText: '¥20,900' });
  } finally {
    delete global.getApp;
    delete global.Component;
    delete global.wx;
  }
});
