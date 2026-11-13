const assert = require('node:assert/strict');

const app = { globalData: { apiBaseUrl: 'https://example.com/api', mediaBaseUrl: '', session: { token: 'A' }, sessionLoaded: true } };
global.getApp = () => app;
const requests = [];
global.wx = {
  getStorageSync: () => null,
  request(options) {
    requests.push(`${options.method} ${options.url.replace('https://example.com/api', '')}`);
    options.success({ statusCode: 200, data: options.method === 'GET' ? [{ id: 'c1', status: 'available' }] : {} });
  }
};
const api = require('../utils/api');
const couponStore = require('../utils/couponStore');

(async () => {
  const first = await couponStore.load();
  first[0].status = 'mutated';
  const second = await couponStore.load();
  assert.equal(requests.length, 1, 'reused within the freshness window');
  assert.equal(second[0].status, 'available', 'callers get their own copy');

  await new Promise((resolve) => setTimeout(resolve, 2));
  await api.request('/bookings', { method: 'POST' });
  await couponStore.load();
  assert.deepEqual(requests, ['GET /auth/coupons', 'POST /bookings', 'GET /auth/coupons'], 'a write invalidates the cache');

  await couponStore.load({ force: true });
  assert.equal(requests.length, 4);

  app.globalData.session = { token: 'B' };
  await couponStore.load();
  assert.equal(requests.length, 5, 'another account never sees the cached coupons');
})().catch((error) => { console.error(error); process.exitCode = 1; });
