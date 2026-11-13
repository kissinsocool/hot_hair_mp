const assert = require('node:assert/strict');

let now = 100000;
let lastBookingEvent = 0;
let session = { token: 'A', user: { displayName: '用户' } };
const requests = [];
const storageWrites = [];
let definition;
Date.now = () => now;
const app = { globalData: { apiBaseUrl: 'https://example.com/api', mediaBaseUrl: '', sessionLoaded: true, get session() { return session; }, set session(value) { session = value; } } };
global.getApp = () => app;
global.getCurrentPages = () => [];
global.Page = (value) => { definition = value; };
global.wx = {
  getStorageSync: () => null,
  setStorageSync(key, value) { storageWrites.push(key); },
  request(options) { requests.push(options); },
  navigateTo() {},
  showToast() {}
};
require.cache[require.resolve('../utils/bookingSocket')] = {
  exports: { lastEventAt: () => lastBookingEvent, reset() {}, subscribe: () => () => {} }
};
const api = require('../utils/api');
const freshness = require('../utils/freshness');
const analytics = require('../utils/analytics');

const flush = () => new Promise((resolve) => setImmediate(resolve));
const paths = () => requests.map((request) => `${request.method} ${request.url.replace('https://example.com/api', '')}`);
async function respondAll(handler) {
  await flush();
  for (const request of requests.filter((item) => !item.done)) {
    request.done = true;
    request.success({ statusCode: 200, data: handler(request.url), header: {} });
  }
  await flush();
}
function createPage(overrides = {}) {
  return { ...definition, data: structuredClone(definition.data), setData(values) { Object.assign(this.data, values); }, ...overrides };
}

(async () => {
  // 判定规则：时间内、同账号、之后没有写操作和预约推送。
  let stamp = freshness.stamp();
  assert.equal(freshness.isFresh(null), false);
  assert.equal(freshness.isFresh(stamp), true);
  now += freshness.FRESH_MS;
  assert.equal(freshness.isFresh(stamp), false, '超过时长后失效');

  stamp = freshness.stamp();
  now += 10;
  analytics.track('home_exposure');
  await respondAll(() => ({}));
  assert.equal(freshness.isFresh(stamp), true, '埋点请求不算写操作');
  api.request('/salons');
  await respondAll(() => []);
  assert.equal(freshness.isFresh(stamp), true, '读请求不影响');
  const writing = api.request('/favorites/s1', { method: 'PUT' });
  await respondAll(() => ({}));
  await writing;
  assert.equal(freshness.isFresh(stamp), false, '写请求完成后失效');

  stamp = freshness.stamp();
  now += 10;
  lastBookingEvent = now;
  assert.equal(freshness.isFresh(stamp), false, '收到预约推送后失效');

  stamp = freshness.stamp();
  session = { token: 'B' };
  assert.equal(freshness.isFresh(stamp), false, '切换账号后失效');
  session = { token: 'A', user: { displayName: '用户' } };

  // 收藏页：短时间内返回不重新请求；取消收藏本地移除，之后返回再同步一次。
  require('../pages/favorites/favorites');
  const favorites = createPage();
  requests.length = 0;
  favorites.onShow();
  await respondAll(() => [{ id: 's1', name: '店一' }, { id: 's2', name: '店二' }]);
  assert.deepEqual(paths(), ['GET /favorites']);
  assert.equal(favorites.data.salons.length, 2);
  now += 5000;
  favorites.onShow();
  await flush();
  assert.equal(requests.length, 1, '短时间内返回不重复请求');
  const removing = favorites.toggle({ currentTarget: { dataset: { id: 's1' } } });
  await respondAll(() => ({}));
  await removing;
  assert.deepEqual(paths(), ['GET /favorites', 'DELETE /favorites/s1'], '取消收藏后不重新请求列表');
  assert.deepEqual(favorites.data.salons.map((salon) => salon.id), ['s2']);
  favorites.onShow();
  await respondAll(() => [{ id: 's2', name: '店二' }]);
  assert.equal(paths().filter((item) => item === 'GET /favorites').length, 2, '有过写操作后返回时重新读取');
  now += freshness.FRESH_MS;
  favorites.onShow();
  await respondAll(() => [{ id: 's2', name: '店二' }]);
  assert.equal(paths().filter((item) => item === 'GET /favorites').length, 3, '超过时长后重新读取');

  // 我的页：短时间内返回不重复请求；资料没变化时不写本地存储。
  require('../pages/profile/profile');
  const profile = createPage();
  const profileResponse = (url) => url.endsWith('/auth/me') ? { user: { displayName: '用户' } } : [];
  requests.length = 0;
  storageWrites.length = 0;
  profile.onShow();
  await respondAll(profileResponse);
  assert.deepEqual(paths().sort(), ['GET /auth/coupons', 'GET /auth/me']);
  assert.deepEqual(storageWrites, [], '资料未变化不写入本地存储');
  now += 5000;
  profile.onShow();
  await flush();
  assert.equal(requests.length, 2, '短时间内返回不重复请求');
  // 领券等写操作之后必须重新读取。
  const claiming = api.request('/auth/coupon-campaign/claim', { method: 'POST' });
  await respondAll(() => ({}));
  await claiming;
  requests.length = 0;
  profile.onShow();
  await respondAll((url) => url.endsWith('/auth/me') ? { user: { displayName: '新昵称' } } : [{ id: 'c1' }]);
  assert.deepEqual(paths().sort(), ['GET /auth/coupons', 'GET /auth/me']);
  assert.equal(profile.data.displayName, '新昵称');
  assert.deepEqual(storageWrites, ['session'], '资料变化时才写入');
  assert.equal(profile.data.coupons.length, 1);
})().catch((error) => { console.error(error); process.exitCode = 1; });
