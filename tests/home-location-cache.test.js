const assert = require('node:assert/strict');

let pageDefinition;
let locationCallbacks;
const storage = {};
const scrolls = [];

global.getApp = () => ({
  globalData: { apiBaseUrl: 'https://example.com/api', mediaBaseUrl: '', session: null, sessionLoaded: true }
});
global.wx = {
  getStorageSync: (key) => storage[key],
  setStorage({ key, data }) { storage[key] = data; },
  removeStorage({ key }) { delete storage[key]; },
  getWindowInfo: () => ({ windowWidth: 375, statusBarHeight: 20 }),
  getFuzzyLocation(options) { locationCallbacks = options; }
};
global.Page = (options) => { pageDefinition = options; };

require('../pages/home/home');

function createPage() {
  return {
    ...pageDefinition,
    data: { ...pageDefinition.data },
    loads: [],
    setData(values) { Object.assign(this.data, values); },
    loadSalons() { this.loads.push(`${this.data.latitude},${this.data.longitude}`); },
    scrollToTop(callback) { scrolls.push(true); callback(); }
  };
}

// 没有缓存时，仍然等定位返回后才加载，并记住这次定位。
let page = createPage();
page.onLoad();
assert.deepEqual(page.loads, [], '首次使用没有可用位置，等待定位');
locationCallbacks.success({ latitude: 31.2, longitude: 121.5 });
locationCallbacks.complete();
assert.deepEqual(page.loads, ['31.2,121.5']);
assert.deepEqual(storage.homeLastLocation, { latitude: 31.2, longitude: 121.5 });
assert.equal(scrolls.length, 0);

// 有缓存时立即按上次定位加载；位置基本没变则不重复请求。
page = createPage();
page.onLoad();
assert.deepEqual(page.loads, ['31.2,121.5'], '首屏不等待定位');
assert.equal(page.data.locatedOnce, true);
assert.equal(page.formatDistance(0.5), '500 m');
locationCallbacks.success({ latitude: 31.201, longitude: 121.501 });
locationCallbacks.complete();
assert.deepEqual(page.loads, ['31.2,121.5'], '位置变化不足阈值不重新加载');
assert.equal(page.data.latitude, 31.2);

// 位置变化明显时回到顶部并按新位置重新加载。
page = createPage();
page.onLoad();
locationCallbacks.success({ latitude: 39.9, longitude: 116.4 });
locationCallbacks.complete();
assert.deepEqual(page.loads, ['31.201,121.501', '39.9,116.4']);
assert.equal(scrolls.length, 1);
assert.deepEqual(storage.homeLastLocation, { latitude: 39.9, longitude: 116.4 });

// 等待定位期间用户手动选点，定位结果不能覆盖用户的选择。
page = createPage();
page.onLoad();
page.setData({ latitude: 22.5, longitude: 114.1, locationText: '手动选点', locationIsFuzzy: false });
locationCallbacks.success({ latitude: 31.2, longitude: 121.5 });
locationCallbacks.complete();
assert.equal(page.data.latitude, 22.5);
assert.equal(page.data.locationText, '手动选点');
assert.equal(page.loads.length, 1);

// 定位失败时清除缓存并回到默认城市，与未缓存时的行为一致。
page = createPage();
page.onLoad();
assert.deepEqual(page.loads, ['31.2,121.5']);
locationCallbacks.fail();
locationCallbacks.complete();
assert.equal(storage.homeLastLocation, undefined);
assert.equal(page.data.latitude, 39.9042);
assert.equal(page.data.locatedOnce, false);
assert.equal(page.data.locationFailed, true);
assert.deepEqual(page.loads, ['31.2,121.5', '39.9042,116.4074']);

// 损坏的缓存不使用。
storage.homeLastLocation = { latitude: '31.2', longitude: null };
page = createPage();
page.onLoad();
assert.deepEqual(page.loads, []);
