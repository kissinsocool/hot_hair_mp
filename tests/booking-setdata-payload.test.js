const assert = require('node:assert/strict');
const { applyData } = require('./support/setData');
const { dataPatch } = require('../utils/dataPatch');

// dataPatch：未变化的字段不发送；等长列表按路径更新；长度变化或含 undefined 时整体替换。
assert.deepEqual(dataPatch({ a: 1, list: [{ id: 1, tags: ['x'] }] }, { a: 1, list: [{ id: 1, tags: ['x'] }] }), {});
assert.deepEqual(
  dataPatch(
    { list: [{ id: 1, className: '' }, { id: 2, className: 'active' }] },
    { list: [{ id: 1, className: 'active' }, { id: 2, className: '' }] }
  ),
  { 'list[0].className': 'active', 'list[1].className': '' }
);
assert.deepEqual(dataPatch({ list: [{ id: 1 }] }, { list: [{ id: 1 }, { id: 2 }] }), { list: [{ id: 1 }, { id: 2 }] });
assert.deepEqual(
  dataPatch({ list: [{ id: 1, fee: '¥20' }] }, { list: [{ id: 1, fee: undefined }] }),
  { 'list[0]': { id: 1, fee: undefined } }
);

let pageDefinition;
const requests = [];
global.getApp = () => ({
  globalData: { apiBaseUrl: 'https://example.com/api', mediaBaseUrl: '', session: { token: 'token' }, sessionLoaded: true }
});
global.wx = {
  getStorageSync: () => 'anonymous-id',
  request(options) { requests.push(options); },
  showToast() {}
};
global.Page = (options) => { pageDefinition = options; };
require('../pages/booking/booking');
const analytics = require('../utils/analytics');
analytics.track = () => Promise.resolve();

const writes = [];
const page = {
  ...pageDefinition,
  salonId: 'salon-1',
  data: structuredClone(pageDefinition.data),
  setData(values) { writes.push(values); applyData(this.data, values); }
};

async function main() {
  const loading = page.load();
  requests[0].success({
    statusCode: 200,
    data: {
      id: 'salon-1',
      reviews: [{ id: 'r1', comment: '不应传给视图层' }],
      staff: [{ id: 'staff-1', name: 'Tony' }],
      services: [{ id: 'service-1', name: '剪发', tagIds: ['wash_cut_blow'], priceFen: 100, internal: 'x' }],
      closedDates: []
    }
  });
  await new Promise((resolve) => setImmediate(resolve));

  // 店铺数据到达后表单立即可见，时间段仍在加载。
  assert.equal(page.data.loading, false, '表单不等待时间段接口');
  assert.equal(page.data.slotsLoading, true);
  assert.equal(writes.some((values) => 'salon' in values || 'slots' in values), false, '原始数据不进入 setData');
  assert.equal('internal' in page.data.serviceOptions[0], false, '套餐只保留模板字段');

  requests.at(-1).success({
    statusCode: 200,
    data: [
      { time: '10:00', startTime: '2999-01-01T10:00:00+08:00', isAvailable: true },
      { time: '11:00', startTime: '2999-01-01T11:00:00+08:00', isAvailable: true }
    ]
  });
  await loading;
  assert.equal(page.data.slotsLoading, false);
  assert.deepEqual(page.data.slotOptions.map((slot) => slot.time), ['10:00', '11:00']);

  // 选择时间段只更新选中态，不重传任何列表。
  writes.length = 0;
  page.selectTime({ currentTarget: { dataset: { time: '10:00', available: true } } });
  assert.deepEqual(writes, [{ selectedTime: '10:00', 'slotOptions[0].className': 'active' }]);

  writes.length = 0;
  page.selectTime({ currentTarget: { dataset: { time: '11:00', available: true } } });
  assert.deepEqual(writes, [{
    selectedTime: '11:00',
    'slotOptions[0].className': '',
    'slotOptions[1].className': 'active'
  }]);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
