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
    salon: {
      services: [
        { id: 'service-1', tags: [] },
        { id: 'service-2', tags: [] }
      ],
      staff: [
        { id: 'staff-a', name: 'A' },
        { id: 'staff-b', name: 'B' }
      ]
    },
    selectedServiceId: 'service-1',
    selectedStaffId: 'staff-a',
    selectedDate: '2030-01-02',
    slots: [{ time: '10:00', startTime: '2030-01-02T10:00:00+08:00', isAvailable: true }],
    slotOptions: [{ time: '10:00', startTime: '2030-01-02T10:00:00+08:00', isAvailable: true }]
  },
  setData(values) { Object.assign(this.data, values); }
};

async function respond(promise, time) {
  requests.at(-1).success({
    statusCode: 200,
    data: [{ time, startTime: `2030-01-02T${time}:00+08:00`, isAvailable: true }]
  });
  await promise;
}

async function main() {
  await respond(page.selectService({ currentTarget: { dataset: { id: 'service-2' } } }), '11:00');
  assert.equal(page.data.slotsAnimating, false, '切换套餐不应触发时间段切换动画');

  await respond(page.selectDate({ currentTarget: { dataset: { value: '2030-01-03' } } }), '11:30');
  assert.equal(page.data.slotsAnimating, true, '切换日期应触发时间段切换动画');
  page.finishSlotAnimation();

  await respond(page.selectStaff({ currentTarget: { dataset: { id: 'staff-b' } } }), '12:00');
  assert.equal(page.data.slotsAnimating, true, '切换理发师应触发时间段切换动画');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
