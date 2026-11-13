const assert = require('node:assert/strict');
const test = require('node:test');

// 没有缓存位置的冷启动：定位迟迟不返回时先展示默认城市；定位不可用时优先回到用户上次手动选择的位置。
const storage = {};
let locationCallbacks;
let navigateOptions;
const timers = new Map();
let timerId = 0;
global.setTimeout = (callback, ms) => { timers.set(++timerId, { callback, ms }); return timerId; };
global.clearTimeout = (id) => { timers.delete(id); };
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

function coldStart(stored = {}) {
  for (const key of Object.keys(storage)) delete storage[key];
  Object.assign(storage, stored);
  timers.clear();
  const page = {
    ...definition,
    data: { ...definition.data },
    loads: [],
    scrolls: 0,
    setData(values) { Object.assign(this.data, values); },
    loadSalons() { this.loads.push(`${this.data.latitude},${this.data.longitude}`); },
    scrollToTop(callback) { this.scrolls += 1; callback(); }
  };
  page.onLoad();
  return page;
}
function fireLocateTimeout() {
  const pending = [...timers.entries()].filter(([, timer]) => timer.ms === 6000);
  assert.equal(pending.length, 1, '等待定位期间有且只有一个超时计时');
  timers.delete(pending[0][0]);
  pending[0][1].callback();
}
const locateTimers = () => [...timers.values()].filter((timer) => timer.ms === 6000).length;

test('a location that returns in time cancels the timeout', () => {
  const page = coldStart();
  assert.deepEqual(page.loads, []);
  locationCallbacks.success({ latitude: 31.2, longitude: 121.5 });
  locationCallbacks.complete();
  assert.equal(locateTimers(), 0);
  assert.deepEqual(page.loads, ['31.2,121.5']);
  assert.equal(page.scrolls, 0);
});

test('after the timeout the default city is shown, then replaced when the location arrives', () => {
  const page = coldStart();
  fireLocateTimeout();
  assert.deepEqual(page.loads, ['39.9042,116.4074']);
  assert.equal(page.data.locationFailed, true, '提示当前是默认城市');
  locationCallbacks.success({ latitude: 31.2, longitude: 121.5 });
  locationCallbacks.complete();
  assert.deepEqual(page.loads, ['39.9042,116.4074', '31.2,121.5']);
  assert.equal(page.scrolls, 1, '替换已展示的列表前先回到顶部');
  assert.equal(page.data.locationFailed, false);
  assert.equal(page.data.locatedOnce, true);
});

test('after the timeout a failed location keeps the default list without requesting it again', () => {
  const page = coldStart();
  fireLocateTimeout();
  locationCallbacks.fail();
  locationCallbacks.complete();
  assert.deepEqual(page.loads, ['39.9042,116.4074']);
  assert.equal(page.data.locationFailed, true);
});

test('a manual pick before the timeout wins and the timeout does nothing', () => {
  const page = coldStart();
  page.openLocation();
  navigateOptions.events.locationSelected({ latitude: 22.54, longitude: 114.06, name: '深圳湾' });
  assert.equal(locateTimers(), 0);
  assert.deepEqual(page.loads, [], '列表由首页回到前台时按手选位置加载');
  assert.equal(page.data.latitude, 22.54);
  assert.equal(page.data.locationText, '深圳湾');
  assert.equal(page.data.locationFailed, false);
});

test('with a cached location the list loads at once and no timeout is needed', () => {
  const page = coldStart({ homeLastLocation: { latitude: 31.2, longitude: 121.5 } });
  assert.deepEqual(page.loads, ['31.2,121.5']);
  assert.equal(locateTimers(), 0);
});

test('a manual pick is remembered and used on the next cold start when locating fails', () => {
  const first = coldStart();
  first.openLocation();
  navigateOptions.events.locationSelected({ latitude: 22.54, longitude: 114.06, name: '深圳湾' });
  assert.deepEqual(storage.homeManualLocation, { latitude: 22.54, longitude: 114.06, name: '深圳湾' });

  const next = coldStart({ homeManualLocation: storage.homeManualLocation });
  locationCallbacks.fail();
  locationCallbacks.complete();
  assert.deepEqual(next.loads, ['22.54,114.06']);
  assert.equal(next.data.locationText, '深圳湾');
  assert.equal(next.data.locatedOnce, true);
  assert.equal(next.data.locationFailed, false);
  assert.equal(next.data.locationIsFuzzy, false);
});

test('when locating works the current location is used, not an old manual pick', () => {
  const page = coldStart({ homeManualLocation: { latitude: 22.54, longitude: 114.06, name: '深圳湾' } });
  locationCallbacks.success({ latitude: 31.2, longitude: 121.5 });
  locationCallbacks.complete();
  assert.deepEqual(page.loads, ['31.2,121.5']);
  assert.equal(page.data.locationText, '选择定位');
  assert.equal(page.data.locationIsFuzzy, true);
});

test('after the timeout a failed location switches from the default city to the remembered manual pick', () => {
  const page = coldStart({ homeManualLocation: { latitude: 22.54, longitude: 114.06, name: '深圳湾' } });
  fireLocateTimeout();
  assert.deepEqual(page.loads, ['39.9042,116.4074']);
  locationCallbacks.fail();
  locationCallbacks.complete();
  assert.deepEqual(page.loads, ['39.9042,116.4074', '22.54,114.06']);
  assert.equal(page.scrolls, 1);
  assert.equal(page.data.locationFailed, false);
});


test('location callbacks after unload cannot restart a query or overwrite the saved location', () => {
  const page = coldStart();
  page.onUnload();
  assert.equal(locateTimers(), 0);
  locationCallbacks.success({ latitude: 31.2, longitude: 121.5 });
  locationCallbacks.complete();
  assert.deepEqual(page.loads, []);
  assert.equal(storage.homeLastLocation, undefined);
});

test('a manual pick after the timeout survives a late successful location', () => {
  const page = coldStart();
  fireLocateTimeout();
  page.applySelectedLocation({ latitude: 22.54, longitude: 114.06, name: '深圳湾' });
  locationCallbacks.success({ latitude: 31.2, longitude: 121.5 });
  locationCallbacks.complete();
  assert.deepEqual(page.loads, ['39.9042,116.4074']);
  assert.equal(page.data.locationText, '深圳湾');
  assert.equal(page.locationChanged, true);
});
