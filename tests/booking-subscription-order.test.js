const assert = require('node:assert/strict');

// 绑定 OpenID 完成后才创建预约，避免商家快速接单时漏发提醒。绑定失败后仍提交预约。
const requests = [];
let session = { token: 'token' };
const app = { globalData: { apiBaseUrl: 'https://example.com/api', mediaBaseUrl: '', sessionLoaded: true, get session() { return session; }, set session(value) { session = value; } } };
global.getApp = () => app;
global.getCurrentPages = () => [{ route: 'pages/confirm/confirm' }];
let definition;
global.Page = (options) => { definition = options; };
const navigations = [];
global.wx = {
  getStorageSync: () => null,
  setStorageSync() {},
  removeStorageSync() {},
  requestSubscribeMessage({ tmplIds, success }) { success({ [tmplIds[0]]: 'accept' }); },
  login({ success }) { success({ code: 'login-code' }); },
  navigateTo({ url }) { navigations.push(url); },
  showToast() {},
  request(options) { requests.push(options); }
};
require.cache[require.resolve('../utils/bookingSocket')] = {
  exports: { lastEventAt: () => 0, reset() {}, subscribe: () => () => {} }
};
require('../pages/confirm/confirm');
const api = require('../utils/api');

const flush = () => new Promise((resolve) => setImmediate(resolve));
const path = (request) => `${request.method} ${request.url.replace('https://example.com/api', '')}`;

(async () => {
  const page = {
    ...definition,
    data: {
      ...definition.data,
      bookingStatusTemplateIds: ['template-1'],
      booking: { salonId: 'salon-1', staffId: 'staff-1', serviceId: 'service-1', startTime: '2030-01-02T10:30:00', totalFen: 8800 }
    },
    setData(values) { Object.assign(this.data, values); }
  };

  const writesBefore = api.lastWriteAt();
  const submitting = page.submit();
  await flush();
  assert.deepEqual(requests.map(path), ['POST /auth/wechat/openid']);

  // 微信换取 openid 失败时接口返回 401：不退出登录，不跳登录页。
  requests[0].success({ statusCode: 401, data: { message: '微信用户标识获取失败' }, header: {} });
  await flush();
  assert.deepEqual(session, { token: 'token' });
  assert.deepEqual(navigations, []);
  assert.equal(api.lastWriteAt(), writesBefore, '绑定 openid 不算改变用户数据的写操作');

  assert.deepEqual(requests.map(path), ['POST /auth/wechat/openid', 'POST /bookings']);
  requests[1].success({ statusCode: 201, data: { booking: { servicePriceFen: 8800, staffExtraServiceFeeFen: 0, originalAmountFen: 8800, couponDiscountFen: 0, payableAmountFen: 8800 } }, header: {} });
  await submitting;
  assert.equal(page.data.submitted, true);
  assert.equal(page.data.successVisible, true);

  // 用户拒绝订阅时不绑定 openid，预约照常提交。
  requests.length = 0;
  global.wx.requestSubscribeMessage = ({ tmplIds, success }) => success({ [tmplIds[0]]: 'reject' });
  const declined = { ...page, data: { ...page.data, submitted: false, successVisible: false }, _submitting: false };
  const second = declined.submit();
  await flush();
  assert.deepEqual(requests.map(path), ['POST /bookings']);
  requests[0].success({ statusCode: 201, data: {}, header: {} });
  await second;
  assert.equal(declined.data.submitted, true);
})().catch((error) => { console.error(error); process.exitCode = 1; });
