const assert = require('node:assert/strict');
const test = require('node:test');

// 首次启动、没有定位缓存时，用户在模糊定位返回前手动选点：
// 之后无论模糊定位成功还是失败，首页都保留手选的名称和坐标，不再按其他位置查询店铺。
const storage = {};
let locationCallbacks;
let navigateOptions;
global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api', mediaBaseUrl: '', session: null, sessionLoaded: true } });
global.wx = {
  getStorageSync: (key) => storage[key],
  setStorage({ key, data }) { storage[key] = data; },
  removeStorage({ key }) { delete storage[key]; },
  getWindowInfo: () => ({ windowWidth: 375, statusBarHeight: 20, windowHeight: 700 }),
  getFuzzyLocation(options) { locationCallbacks = options; },
  navigateTo(options) { navigateOptions = options; }
};
let definition;
global.Page = (options) => { definition = options; };
require('../pages/home/home');

function coldStartWithManualPick() {
  for (const key of Object.keys(storage)) delete storage[key];
  const page = {
    ...definition,
    data: { ...definition.data },
    loads: [],
    setData(values) { Object.assign(this.data, values); },
    loadSalons() { this.loads.push(`${this.data.latitude},${this.data.longitude}`); },
    scrollToTop(callback) { callback(); }
  };
  page.onLoad();
  assert.deepEqual(page.loads, [], '没有缓存时等待定位');
  // 定位还没返回，用户先去选位置页手动选点。
  page.openLocation();
  navigateOptions.events.locationSelected({ latitude: 22.54, longitude: 114.06, name: '深圳湾' });
  page.locationChanged = false;
  page.loadSalons();
  return page;
}

function assertManualPickKept(page) {
  assert.equal(page.data.locationText, '深圳湾');
  assert.equal(page.data.latitude, 22.54);
  assert.equal(page.data.longitude, 114.06);
  assert.equal(page.data.locationIsFuzzy, false);
  assert.equal(page.data.locationFailed, false);
  assert.deepEqual(page.loads, ['22.54,114.06'], '只按手选位置查询，不再按其他位置重新加载');
}

test('a late fuzzy location does not replace a manual pick on a cold start without cache', () => {
  const page = coldStartWithManualPick();
  locationCallbacks.success({ latitude: 39.9, longitude: 116.4 });
  locationCallbacks.complete();
  assertManualPickKept(page);
  assert.deepEqual(storage.homeLastLocation, { latitude: 39.9, longitude: 116.4 }, '模糊定位仍记住，供下次冷启动使用');
});

test('a failed fuzzy location does not reset a manual pick to the default city', () => {
  const page = coldStartWithManualPick();
  locationCallbacks.fail();
  locationCallbacks.complete();
  assertManualPickKept(page);
});

test('without a manual pick the fuzzy result is still applied and failures still fall back', () => {
  for (const key of Object.keys(storage)) delete storage[key];
  const make = () => ({
    ...definition, data: { ...definition.data }, loads: [],
    setData(values) { Object.assign(this.data, values); },
    loadSalons() { this.loads.push(`${this.data.latitude},${this.data.longitude}`); },
    scrollToTop(callback) { callback(); }
  });
  const located = make();
  located.onLoad();
  locationCallbacks.success({ latitude: 31.2, longitude: 121.5 });
  assert.deepEqual(located.loads, ['31.2,121.5']);
  for (const key of Object.keys(storage)) delete storage[key];
  const failed = make();
  failed.onLoad();
  locationCallbacks.fail();
  assert.equal(failed.data.locationFailed, true);
  assert.deepEqual(failed.loads, ['39.9042,116.4074']);
});
