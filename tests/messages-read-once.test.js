const assert = require('node:assert/strict');

// 消息页标记已读：同一批消息只提交一次；标记已读不让其他页面的数据缓存失效；
// 订单页在列表仍有效时只同步未读角标，不重新读取订单列表。
let now = 100000;
Date.now = () => now;
let session = { token: 'A' };
let subscription;
const requests = [];
const app = { globalData: { apiBaseUrl: 'https://example.com/api', mediaBaseUrl: '', sessionLoaded: true, get session() { return session; }, set session(value) { session = value; } } };
global.getApp = () => app;
global.getCurrentPages = () => [];
global.wx = {
  getStorageSync: () => null,
  navigateTo() {},
  showToast() {},
  getWindowInfo: () => ({ windowWidth: 375, statusBarHeight: 20 }),
  request(options) { requests.push(options); }
};
require.cache[require.resolve('../utils/bookingSocket')] = {
  exports: { lastEventAt: () => 0, reset() {}, subscribe(listener) { subscription = listener; return () => {}; } }
};
const freshness = require('../utils/freshness');

const definitions = {};
for (const name of ['messages', 'orders']) {
  global.Page = (value) => { definitions[name] = value; };
  require(`../pages/${name}/${name}`);
}
const createPage = (name) => ({
  ...definitions[name],
  data: structuredClone(definitions[name].data),
  setData(values) { Object.assign(this.data, values); }
});
const flush = () => new Promise((resolve) => setImmediate(resolve));
const paths = () => requests.map((request) => `${request.method} ${request.url.replace('https://example.com/api', '').split('?')[0]}`);
async function respondAll(handler) {
  for (let round = 0; round < 5; round += 1) {
    await flush();
    for (const request of requests.filter((item) => !item.done)) {
      request.done = true;
      request.success({ statusCode: 200, data: handler(request), header: {} });
    }
  }
  await flush();
}

(async () => {
  let messages = [{ id: 'm2', createdAt: '2030-01-02T00:00:00Z' }, { id: 'm1', createdAt: '2030-01-01T00:00:00Z' }];
  let unread = 2;
  const respond = (request) => {
    if (request.url.includes('/booking-messages/unread-count')) return { count: unread };
    if (request.url.includes('/booking-messages/read')) { unread = 0; return { updatedCount: 2 }; }
    if (request.url.includes('/booking-messages')) return messages;
    return [];
  };

  // 订单页先加载，记下未读数 2。
  const orders = createPage('orders');
  orders.onShow();
  await respondAll(respond);
  assert.equal(orders.data.unreadMessageCount, 2);
  const stamp = freshness.stamp();
  requests.length = 0;
  now += 1000;

  // 进入消息页：读取并标记已读一次。
  const page = createPage('messages');
  page.onLoad();
  page.onShow();
  await respondAll(respond);
  assert.deepEqual(paths(), ['GET /booking-messages', 'PATCH /booking-messages/read']);
  assert.equal(requests[1].data.through, '2030-01-02T00:00:00Z');
  assert.equal(freshness.isFresh(stamp), true, '标记已读不让其他页面已加载的数据失效');

  // 推送连接鉴权后的补刷新读到同一批消息：重新读取列表，但不重复标记已读。
  requests.length = 0;
  subscription({ event: 'authenticated' });
  await respondAll(respond);
  assert.deepEqual(paths(), ['GET /booking-messages']);

  // 出现新消息时再次标记。
  requests.length = 0;
  messages = [{ id: 'm3', createdAt: '2030-01-03T00:00:00Z' }, ...messages];
  subscription({ event: 'booking.updated' });
  await respondAll(respond);
  assert.deepEqual(paths(), ['GET /booking-messages', 'PATCH /booking-messages/read']);
  assert.equal(requests[1].data.through, '2030-01-03T00:00:00Z');

  // 标记失败时不记为已标记，下次读取会重试。
  requests.length = 0;
  messages = [{ id: 'm4', createdAt: '2030-01-04T00:00:00Z' }, ...messages];
  page.load({ keepLoaded: true });
  await flush();
  requests[0].success({ statusCode: 200, data: messages, header: {} });
  await flush();
  requests[1].success({ statusCode: 500, data: {}, header: {} });
  await flush();
  requests.length = 0;
  page.load({ keepLoaded: true });
  await respondAll(respond);
  assert.deepEqual(paths(), ['GET /booking-messages', 'PATCH /booking-messages/read']);

  // 回到订单页：列表仍然有效，不重新读取订单，只把未读角标同步为 0。
  requests.length = 0;
  orders.onShow();
  await respondAll(respond);
  assert.deepEqual(paths(), ['GET /booking-messages/unread-count']);
  assert.equal(orders.data.unreadMessageCount, 0);
  // 未读数没有失效时再次返回，不发任何请求。
  requests.length = 0;
  orders.onShow();
  await respondAll(respond);
  assert.deepEqual(paths(), []);
})().catch((error) => { console.error(error); process.exitCode = 1; });
