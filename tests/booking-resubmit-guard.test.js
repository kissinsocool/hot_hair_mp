const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadConfirm(api, wx, { realCoupons = false } = {}) {
  let definition;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../pages/confirm/confirm.js'), 'utf8'), {
    Page: value => { definition = value; },
    require: name => name.endsWith('/api') ? api
      : name.endsWith('/couponStore') ? { load: () => api.request('/auth/coupons') }
      : name.endsWith('/money') ? { formatFen: amount => `¥${amount / 100}` } : {},
    wx
  });
  const page = { ...definition, data: { ...definition.data }, setData(value) { Object.assign(this.data, value); },
    async loadCoupons() {}, loadSubscriptionSettings() {}, async requestBookingSubscription() {} };
  if (realCoupons) page.loadCoupons = definition.loadCoupons;
  return page;
}

test('a submitted booking cannot be submitted again and leaving replaces the confirm page', async () => {
  let creates = 0;
  const navigation = [];
  const api = { formatTime: value => value, async request() { creates += 1; return {}; } };
  const page = loadConfirm(api, {
    showToast() {}, showModal() {},
    redirectTo({ url }) { navigation.push(['redirectTo', url]); },
    navigateTo({ url }) { navigation.push(['navigateTo', url]); }
  });
  page.onLoad({ data: encodeURIComponent(JSON.stringify({ servicePriceFen: 5000, startTime: '2030-01-01T10:00:00' })) });
  await page.submit();
  assert.equal(page.data.submitted, true);
  page.openMessages();
  await page.submit();
  assert.equal(creates, 1);
  assert.deepEqual(navigation, [['redirectTo', '/pages/messages/messages']]);
  const wxml = fs.readFileSync(path.join(__dirname, '../pages/confirm/confirm.wxml'), 'utf8');
  assert.match(wxml, /disabled="\{\{submitting \|\| submitted\}\}"/);
});

test('booking page reloads slots when shown again after a write', async () => {
  let definition;
  let lastWrite = 0;
  const slotRequests = [];
  const api = {
    session: () => ({ token: 't' }),
    lastWriteAt: () => lastWrite,
    thumbnailUrl: value => value,
    requireLogin: () => true,
    async request(url) { slotRequests.push(url); return []; }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../pages/booking/booking.js'), 'utf8'), {
    Page: value => { definition = value; },
    require: (name) => {
      if (name.endsWith('/api')) return api;
      if (name.endsWith('/dataPatch')) return require('../utils/dataPatch');
      if (name.includes('serviceCategories')) return { SERVICE_TABS: [{ id: 'cut' }], serviceCategory: () => 'cut', serviceMatchesCategory: () => true };
      if (name.endsWith('/money')) return { formatFen: v => String(v) };
      return new Proxy({}, { get: () => () => [] });
    },
    wx: { showToast() {} }, Date, Promise
  });
  const page = { ...definition, data: { ...definition.data }, setData(v) { Object.assign(this.data, v); } };
  page.salonId = 's';
  page.salon = { services: [], staff: [] };
  page.setData({ selectedDate: '2030-01-01' });
  await page.loadSlots();
  assert.equal(slotRequests.length, 1);
  await page.onShow();
  assert.equal(slotRequests.length, 1, 'no write since slots were loaded');
  lastWrite = Date.now() + 1;
  await page.onShow();
  assert.equal(slotRequests.length, 2);
});

test('a timed-out booking request asks the user to check orders instead of retrying blindly', async () => {
  let modal;
  let toast;
  const api = { formatTime: value => value, async request() { const e = new Error('请求超时，请稍后重试'); e.timeout = true; throw e; } };
  const page = loadConfirm(api, { showToast(v) { toast = v; }, showModal(v) { modal = v; }, switchTab() {} });
  page.onLoad({ data: encodeURIComponent(JSON.stringify({ servicePriceFen: 5000, startTime: '2030-01-01T10:00:00' })) });
  await page.submit();
  assert.equal(modal.title, '提交结果未确认');
  assert.equal(toast, undefined);
  assert.equal(page.data.submitting, false);
});

test('a coupon loading failure is shown and tapping retries', async () => {
  let attempts = 0;
  const api = { formatTime: value => value, async request() { attempts += 1; throw new Error('网络连接失败'); } };
  const page = loadConfirm(api, { showToast() {}, navigateTo() { throw new Error('should retry instead of opening coupons'); } }, { realCoupons: true });
  page.onLoad({ data: encodeURIComponent(JSON.stringify({ servicePriceFen: 5000, startTime: '2030-01-01T10:00:00' })) });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(page.data.couponLoadFailed, true);
  await page.chooseCoupon();
  assert.equal(attempts, 2);
});
