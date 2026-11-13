const assert = require('node:assert/strict');

// 写请求被服务端拒绝（如 409 时段已被约）时服务端状态可能已变化，仍要记为一次写操作，
// 依赖 lastWriteAt 的页面（预约页时段、优惠券缓存）才会在返回时重新读取。
const requests = [];
global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api', mediaBaseUrl: '', session: { token: 't' }, sessionLoaded: true } });
global.wx = { getStorageSync: () => null, request(options) { requests.push(options); } };
const api = require('../utils/api');

(async () => {
  const before = api.lastWriteAt();
  await new Promise((resolve) => setTimeout(resolve, 2));
  const rejected = api.request('/bookings', { method: 'POST', data: {} });
  requests.pop().success({ statusCode: 409, data: { code: 'BOOKING_SLOT_UNAVAILABLE', message: '该时间段已被预约，请重新选择' } });
  const error = await rejected.catch((err) => err);
  assert.equal(error.code, 'BOOKING_SLOT_UNAVAILABLE');
  assert.equal(error.message, '该时间段已被预约，请重新选择');
  assert.ok(api.lastWriteAt() > before);
})().catch((error) => { console.error(error); process.exitCode = 1; });
