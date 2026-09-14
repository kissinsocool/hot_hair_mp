const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

let pageDefinition;
const requests = [];

global.getApp = () => ({
  globalData: {
    apiBaseUrl: 'https://example.com/api',
    mediaBaseUrl: '',
    session: { token: 'token' }
  }
});
global.wx = {
  getStorageSync: () => ({ token: 'token' }),
  request(options) { requests.push(options); },
  showToast() {}
};
global.Page = (options) => { pageDefinition = options; };

require('../pages/booking/booking');

const page = {
  ...pageDefinition,
  salonId: 'salon-1',
  data: {
    ...pageDefinition.data,
    salon: { services: [{ id: 'service-1', tags: [] }], staff: [] },
    dates: [],
    selectedServiceId: 'service-1',
    selectedStaffId: 'staff-a',
    selectedDate: '2030-01-02',
    selectedTime: '10:00',
    slots: [{ time: '10:00', isAvailable: true }]
  },
  setData(values) { Object.assign(this.data, values); }
};

async function main() {
  const bookingDir = path.join(__dirname, '..', 'pages', 'booking');
  const template = fs.readFileSync(path.join(bookingDir, 'booking.wxml'), 'utf8');
  const styles = fs.readFileSync(path.join(bookingDir, 'booking.wxss'), 'utf8');
  assert.doesNotMatch(template, /时间段加载中/);
  assert.match(template, /slotsAnimating[^>]*slots-previous/);
  assert.match(template, /slots-current \{\{slotsAnimating \? 'entering' : ''\}\}/);
  assert.match(styles, /@keyframes slots-slide-out\s*\{[\s\S]*?translateX\(-100%\)/);
  assert.match(styles, /@keyframes slots-slide-in\s*\{[\s\S]*?translateX\(100%\)/);

  const first = page.loadSlots();
  assert.equal(page.data.selectedTime, '');
  assert.equal(page.data.canSubmit, false);
  assert.equal(page.data.slotsLoading, true);
  assert.deepEqual(page.data.slots.map((slot) => slot.time), ['10:00']);

  page.setData({ selectedStaffId: 'staff-b' });
  const second = page.loadSlots();
  requests[1].success({
    statusCode: 200,
    data: [{ time: '11:00', startTime: '2030-01-02T11:00:00+08:00', isAvailable: true }]
  });
  await second;

  requests[0].success({
    statusCode: 200,
    data: [{ time: '10:00', startTime: '2030-01-02T10:00:00+08:00', isAvailable: true }]
  });
  await first;

  assert.deepEqual(page.data.slots.map((slot) => slot.time), ['11:00']);
  assert.deepEqual(page.data.previousSlotOptions.map((slot) => slot.time), ['10:00']);
  assert.deepEqual(page.data.slotOptions.map((slot) => slot.time), ['11:00']);
  assert.equal(page.data.slotsAnimating, true);
  assert.equal(page.data.slotsLoading, false);

  page.finishSlotAnimation();
  assert.deepEqual(page.data.previousSlotOptions, []);
  assert.equal(page.data.slotsAnimating, false);

  const failed = page.loadSlots();
  requests[2].fail({ errMsg: 'network unavailable' });
  await failed;
  assert.deepEqual(page.data.slots, []);
  assert.equal(page.data.selectedTime, '');
  assert.equal(page.data.slotsLoading, false);
  assert.equal(page.data.slotErrorMessage, '网络连接失败，请检查网络后重试');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
