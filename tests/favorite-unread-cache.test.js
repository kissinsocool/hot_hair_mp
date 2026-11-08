const assert = require('node:assert/strict');

const requests = [];
let now = 1000;
let lastBookingEvent = 0;
let session = { token: 'A' };
Date.now = () => now;
global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api', get session() { return session; } } });
global.wx = {
  getStorageSync: () => null,
  request(options) { requests.push(options); }
};
require.cache[require.resolve('../utils/bookingSocket')] = {
  exports: { lastEventAt: () => lastBookingEvent, reset() {} }
};
const favorites = require('../utils/favorites');
const unread = require('../utils/unreadMessages');
const respond = (data) => requests[requests.length - 1].success({ statusCode: 200, data });
const flush = () => new Promise((resolve) => setImmediate(resolve));

(async () => {
  // 收藏：缓存、写操作同步、请求期间变更不写入过期结果、按账号隔离。
  let loading = favorites.loadIds();
  respond({ salonIds: ['s1'] });
  assert.deepEqual(await loading, ['s1']);
  assert.deepEqual(await favorites.loadIds(), ['s1']);
  assert.equal(requests.length, 1, '缓存期内不重复请求');

  let writing = favorites.setFavorite('s2', true);
  assert.equal(requests[1].method, 'PUT');
  respond({});
  await writing;
  assert.deepEqual((await favorites.loadIds()).sort(), ['s1', 's2']);
  assert.equal(requests.length, 2, '写操作后直接更新缓存');

  loading = favorites.loadIds({ force: true });
  writing = favorites.setFavorite('s1', false);
  requests[3].success({ statusCode: 200, data: {} });
  await writing;
  requests[2].success({ statusCode: 200, data: { salonIds: ['s1', 's2'] } });
  await loading;
  assert.deepEqual(await favorites.loadIds(), ['s2'], '与写操作并发的过期读取结果不得覆盖缓存');
  assert.equal(requests.length, 4);

  writing = favorites.setFavorite('s3', true);
  requests[requests.length - 1].success({ statusCode: 500, data: {} });
  await assert.rejects(writing);
  const afterFailure = favorites.loadIds();
  await flush();
  assert.equal(requests.length, 6, '写失败后放弃缓存重新读取');
  respond({ salonIds: ['s2'] });
  await afterFailure;

  session = { token: 'B' };
  const other = favorites.loadIds();
  await flush();
  assert.equal(requests.length, 7, '切换账号不复用缓存');
  respond({ salonIds: [] });
  assert.deepEqual(await other, []);
  session = null;
  assert.deepEqual(await favorites.loadIds(), [], '未登录不请求');
  assert.equal(requests.length, 7);

  // 未读数：缓存、预约事件后失效、超时失效、手动失效。
  session = { token: 'A' };
  let counting = unread.count();
  respond({ count: 2 });
  assert.equal(await counting, 2);
  assert.equal(await unread.count(), 2);
  assert.equal(requests.length, 8);
  now += 10;
  lastBookingEvent = now;
  counting = unread.count();
  await flush();
  assert.equal(requests.length, 9, '收到预约事件后重新读取');
  respond({ count: 3 });
  assert.equal(await counting, 3);
  now += unread.CACHE_MS + 1;
  counting = unread.count();
  await flush();
  assert.equal(requests.length, 10, '缓存过期后重新读取');
  respond({ count: 3 });
  await counting;
  unread.invalidate();
  counting = unread.count();
  await flush();
  assert.equal(requests.length, 11, '已读后失效');
  respond({ count: 0 });
  assert.equal(await counting, 0);
})().catch((error) => { console.error(error); process.exitCode = 1; });
