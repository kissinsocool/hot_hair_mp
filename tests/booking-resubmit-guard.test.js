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

test('a slot conflict sends the user back to choose another time instead of only showing a toast', async () => {
  let modal;
  let toast;
  let backs = 0;
  const api = {
    formatTime: value => value,
    async request() {
      const error = new Error('该时间段已被预约，请重新选择');
      error.statusCode = 409;
      error.code = 'BOOKING_SLOT_UNAVAILABLE';
      throw error;
    }
  };
  const page = loadConfirm(api, {
    showToast(v) { toast = v; }, showModal(v) { modal = v; }, navigateBack() { backs += 1; }
  });
  page.onLoad({ data: encodeURIComponent(JSON.stringify({ servicePriceFen: 5000, startTime: '2030-01-01T10:00:00' })) });
  await page.submit();
  assert.equal(modal.title, '该时间已不可预约');
  assert.equal(modal.content, '该时间段已被预约，请重新选择');
  assert.equal(modal.confirmText, '重新选择');
  assert.equal(modal.showCancel, false);
  assert.equal(toast, undefined);
  assert.equal(page.data.submitted, false);
  modal.success({ confirm: true });
  assert.equal(backs, 1);
});

test('without the conflict code (older server) a 409 keeps the previous handling', async () => {
  let toast;
  let modal;
  const api = {
    formatTime: value => value,
    async request() { const e = new Error('当前状态已发生变化，请刷新后重试'); e.statusCode = 409; throw e; }
  };
  const page = loadConfirm(api, { showToast(v) { toast = v; }, showModal(v) { modal = v; } });
  page.onLoad({ data: encodeURIComponent(JSON.stringify({ servicePriceFen: 5000, startTime: '2030-01-01T10:00:00' })) });
  await page.submit();
  assert.equal(modal, undefined);
  assert.equal(toast.title, '当前状态已发生变化，请刷新后重试');
});

test('back on the booking page the slots reload while service, stylist and date stay selected', async () => {
  let definition;
  let lastWrite = 0;
  const slotRequests = [];
  const api = {
    session: () => ({ token: 't' }), lastWriteAt: () => lastWrite, thumbnailUrl: value => value,
    requireLogin: () => true,
    async request(url) { slotRequests.push(url); return [{ time: '10:00', startTime: '2030-01-01T10:00:00' }, { time: '11:00', startTime: '2030-01-01T11:00:00' }]; }
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
  page.salon = { services: [{ id: 'v1', name: '剪发' }], staff: [{ id: 'st1', name: 'Tony' }] };
  page.setData({ selectedDate: '2030-01-01', selectedServiceId: 'v1', selectedStaffId: 'st1' });
  await page.loadSlots();
  page.selectTime({ currentTarget: { dataset: { time: '10:00', available: true } } });
  assert.equal(page.data.selectedTime, '10:00');
  lastWrite = Date.now() + 1; // 下单请求被拒绝也会结束一次写请求
  await page.onShow();
  assert.equal(slotRequests.length, 2);
  assert.equal(page.data.selectedTime, '');
  assert.equal(page.data.selectedServiceId, 'v1');
  assert.equal(page.data.selectedStaffId, 'st1');
  assert.equal(page.data.selectedDate, '2030-01-01');
});
