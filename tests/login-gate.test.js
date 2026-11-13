const assert = require('node:assert/strict');
const test = require('node:test');

// 需要登录的非 tab 页面（订单详情、预约消息）在未登录时的各种先后顺序：
// 登录成功后返回要正常加载；没有登录就返回要离开页面，不能卡在加载占位或反复跳回登录页。
let session = null;
let pageStack = [];
const calls = [];
const requests = [];
const app = { globalData: { apiBaseUrl: 'https://example.com/api', mediaBaseUrl: '', sessionLoaded: true, get session() { return session; }, set session(value) { session = value; } } };
global.getApp = () => app;
global.getCurrentPages = () => pageStack;
global.wx = {
  getStorageSync: () => null,
  setStorageSync() {},
  removeStorageSync() {},
  navigateTo({ url, success }) { calls.push(`navigateTo ${url}`); if (success) success(); },
  navigateBack({ fail } = {}) { calls.push('navigateBack'); if (pageStack.length < 2 && fail) fail(); },
  switchTab({ url }) { calls.push(`switchTab ${url}`); },
  reLaunch() { throw new Error('unexpected reLaunch'); },
  showToast() {},
  stopPullDownRefresh() {},
  getWindowInfo: () => ({ windowWidth: 375, statusBarHeight: 20 }),
  request(options) { requests.push(options); }
};
require.cache[require.resolve('../utils/bookingSocket')] = {
  exports: { lastEventAt: () => 0, reset() {}, subscribe: () => () => {} }
};

const definitions = {};
for (const name of ['order-detail', 'messages']) {
  global.Page = (value) => { definitions[name] = value; };
  require(`../pages/${name}/${name}`);
}

const flush = () => new Promise((resolve) => setImmediate(resolve));
function open(name, previousPages = [{ route: 'pages/home/home' }]) {
  calls.length = 0;
  requests.length = 0;
  const page = {
    ...definitions[name],
    route: `pages/${name}/${name}`,
    data: { ...definitions[name].data },
    setData(values) { Object.assign(this.data, values); }
  };
  pageStack = [...previousPages, page];
  return page;
}
const paths = () => requests.map((request) => request.url.replace('https://example.com/api', ''));

test('order detail opened while logged out loads the order after a successful login', async () => {
  session = null;
  const page = open('order-detail');
  page.onLoad({ id: 'b1' });
  page.onShow();
  assert.deepEqual(calls, ['navigateTo /pages/login/login']);
  assert.deepEqual(requests, [], '未登录时不请求订单');

  session = { token: 'T' };
  const loading = page.onShow();
  assert.deepEqual(paths(), ['/bookings/b1'], '登录返回后按进入时的订单编号加载');
  requests[0].success({ statusCode: 200, data: { id: 'b1', status: 'pending', startTime: '2030-01-01T10:00:00+08:00' }, header: {} });
  await loading;
  assert.equal(page.data.loading, false);
  assert.equal(page.data.order.id, 'b1');
  assert.deepEqual(calls, ['navigateTo /pages/login/login'], '不再打开登录页，也不离开页面');
});

for (const name of ['order-detail', 'messages']) {
  test(`${name}: returning from the login page without logging in leaves the page instead of reopening login`, () => {
    session = null;
    const page = open(name);
    page.onLoad({ id: 'b1' });
    page.onShow();
    assert.deepEqual(calls, ['navigateTo /pages/login/login']);
    page.onShow();
    assert.deepEqual(calls, ['navigateTo /pages/login/login', 'navigateBack']);
    assert.deepEqual(requests, []);
  });

  test(`${name}: opened directly as the only page, backing out of login goes home`, () => {
    session = null;
    const page = open(name, []);
    page.onLoad({ id: 'b1' });
    page.onShow();
    page.onShow();
    assert.deepEqual(calls, ['navigateTo /pages/login/login', 'navigateBack', 'switchTab /pages/home/home']);
  });

  test(`${name}: a session that expires on the page opens login once; backing out leaves the page`, async () => {
    session = { token: 'expired' };
    const page = open(name);
    page.onLoad({ id: 'b1' });
    const loading = page.onShow();
    assert.equal(requests.length, 1);
    requests[0].success({ statusCode: 401, data: {}, header: {} });
    await loading;
    await flush();
    assert.equal(session, null);
    assert.deepEqual(calls, ['navigateTo /pages/login/login'], '请求返回 401 时打开一次登录页');
    page.onShow();
    assert.deepEqual(calls, ['navigateTo /pages/login/login', 'navigateBack'], '放弃登录后离开，不再请求、不再跳登录页');
    assert.equal(requests.length, 1);
  });

  test(`${name}: logging in after an expired session reloads the page`, async () => {
    session = { token: 'expired' };
    const page = open(name);
    page.onLoad({ id: 'b1' });
    const loading = page.onShow();
    requests[0].success({ statusCode: 401, data: {}, header: {} });
    await loading;
    await flush();
    session = { token: 'fresh' };
    page.onShow();
    assert.equal(requests.length, 2, '重新登录后再次加载');
    assert.equal(requests[1].header.Authorization, 'Bearer fresh');
    assert.deepEqual(calls, ['navigateTo /pages/login/login']);
    // 之后登录再次失效时，仍会重新打开登录页（之前的标记已清除）。
    assert.equal(page.loginRequested, false);
  });
}
