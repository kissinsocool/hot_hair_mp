const assert = require('node:assert/strict');

const storage = {};
let now = 1_000_000;
const realNow = Date.now;
Date.now = () => now;
global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api', mediaBaseUrl: '', session: null, sessionLoaded: true } });
global.wx = {
  getStorageSync: (key) => storage[key],
  setStorage({ key, data }) { storage[key] = JSON.parse(JSON.stringify(data)); },
  removeStorage({ key }) { delete storage[key]; },
  getWindowInfo: () => ({ windowWidth: 375, statusBarHeight: 20, windowHeight: 700 }),
  getFuzzyLocation() {},
  showToast() {}
};
let definition;
global.Page = (options) => { definition = options; };
const api = require('../utils/api');
const { applyData } = require('./support/setData');
require('../pages/home/home');
const cache = require('../utils/salonListCache');

function createPage() {
  return { ...definition, data: { ...definition.data }, setData(values, callback) { applyData(this.data, values); if (callback) callback(); } };
}

(async () => {
  const location = { latitude: 31.2, longitude: 121.5 };
  storage.homeLastLocation = location;

  // 首次启动没有缓存：等列表接口返回，成功后写入缓存。
  let respond;
  api.requestPage = () => new Promise((resolve) => { respond = resolve; });
  let page = createPage();
  page.onLoad();
  await new Promise(setImmediate);
  assert.ok(page.data.salonCards.every((card) => card.isPlaceholder));
  respond({ items: [{ id: 'old', name: '旧店' }], hasMore: true });
  await new Promise(setImmediate);
  assert.deepEqual(storage[cache.STORAGE_KEY].items, [{ id: 'old', name: '旧店' }]);

  // 再次冷启动：实时结果返回前先展示缓存，且不允许加载更多。
  page = createPage();
  page.onLoad();
  await new Promise(setImmediate);
  assert.deepEqual(page.data.salonCards.map((card) => card.id), ['old']);
  assert.equal(page.data.hasMoreSalons, false);
  respond({ items: [{ id: 'new', name: '新店' }], hasMore: false });
  await new Promise(setImmediate);
  assert.deepEqual(page.data.salonCards.map((card) => card.id), ['new']);

  // 实时结果先到时，迟到的缓存不会覆盖它。
  page = createPage();
  page.salonListLoaded = true;
  await page.showCachedSalons(location);
  assert.ok(page.data.salonCards.every((card) => card.isPlaceholder));

  // 位置不同或缓存过期时不使用。
  assert.equal(cache.read({ latitude: 30, longitude: 120 }), null);
  now += cache.MAX_AGE_MS + 1;
  assert.equal(cache.read(location), null);

  // 搜索结果不写入缓存。
  now = 1_000_000;
  page = createPage();
  page.setData({ latitude: 31.2, longitude: 121.5, searchKeyword: 'x', keyword: 'x' });
  api.requestPage = async () => ({ items: [{ id: 'search' }], hasMore: false });
  await page.loadSalons();
  assert.deepEqual(storage[cache.STORAGE_KEY].items.map((item) => item.id), ['new']);
  Date.now = realNow;
})().catch((error) => { console.error(error); process.exitCode = 1; });
