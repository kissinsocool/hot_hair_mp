const assert = require('node:assert/strict');

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
  const first = page.loadSlots();
  assert.equal(page.data.selectedTime, '');
  assert.equal(page.data.canSubmit, false);
  assert.equal(page.data.slotsLoading, true);

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
  assert.equal(page.data.slotsLoading, false);

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
