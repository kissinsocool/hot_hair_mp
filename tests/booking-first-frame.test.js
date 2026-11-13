const assert = require('node:assert/strict');

const app = { globalData: { apiBaseUrl: 'https://example.com/api', mediaBaseUrl: '', session: { token: 't' }, sessionLoaded: true } };
global.getApp = () => app;
const requests = [];
global.wx = {
  getStorageSync: () => null,
  showToast() {},
  request(options) { requests.push(options); }
};
let definition;
global.Page = (options) => { definition = options; };
const salonDetail = require('../utils/salonDetail');
const { applyData } = require('./support/setData');
require('../pages/booking/booking');

const salon = { id: 's1', services: [{ id: 'v1', name: '剪发', categoryId: 'cut' }], staff: [], closedDates: [] };
function createPage() {
  return { ...definition, data: { ...definition.data }, setData(values, cb) { applyData(this.data, values); if (cb) cb(); } };
}

(async () => {
  // 没有缓存：显示加载占位并请求店铺。
  let page = createPage();
  page.onLoad({ id: 's1' });
  assert.equal(page.data.loading, true);
  const detailRequest = requests.find((r) => r.url.endsWith('/salons/s1'));
  assert.ok(detailRequest);
  detailRequest.success({ statusCode: 200, data: salon });
  await new Promise(setImmediate);

  // 缓存有效：onLoad 同步返回前表单已就绪，首帧不出现加载占位，也不再请求店铺。
  requests.length = 0;
  page = createPage();
  page.onLoad({ id: 's1', serviceId: 'v1' });
  assert.equal(page.data.loading, false);
  assert.equal(page.data.selectedServiceId, 'v1');
  assert.ok(page.data.serviceOptions.length > 0);
  assert.ok(!requests.some((r) => r.url.endsWith('/salons/s1')));

  // 缓存过期后 peek 不返回旧数据。
  const realNow = Date.now;
  Date.now = () => realNow() + salonDetail.CACHE_MS + 1;
  assert.equal(salonDetail.peek('s1'), null);
  Date.now = realNow;
})().catch((error) => { console.error(error); process.exitCode = 1; });
