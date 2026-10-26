const assert = require('node:assert/strict');

let homeDefinition;
let locationDefinition;
let chooseLocation;
let visible = true;
let scrollTop = 2400;
let page;
const requests = [];
const scrolls = [];
global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api', session: null } });
global.wx = {
  getStorageSync: () => 'test-visitor',
  chooseLocation(options) { chooseLocation = options; },
  navigateBack() { visible = true; page.onShow(); },
  showToast() {}
};
global.Page = value => { homeDefinition = value; };
const api = require('../utils/api');
const ad = require('../utils/ad');
require('../pages/home/home');
global.Page = value => { locationDefinition = value; };
require('../pages/location/location');
api.request = async () => ({});
ad.load = async () => ad.DEFAULT;
api.requestPage = async (path) => {
  requests.push({ path, visible, scrollTop });
  return { items: [{ id: 'nearby', name: '新位置附近店铺', tags: [] }], hasMore: false };
};
page = {
  ...homeDefinition,
  data: structuredClone(homeDefinition.data),
  loadNewUserGift() {}, loadFavorites() {}, loadUnreadMessages() {},
  setData(values, callback) { Object.assign(this.data, values); if (callback) callback(); },
  createSelectorQuery() {
    return {
      select(selector) { assert.equal(selector, '#home-list'); return this; },
      node() { return this; },
      exec(callback) {
        assert.equal(visible, true, '滚动位置应在首页可见后更新');
        callback([{ node: { scrollTo(options) { scrollTop = options.top; scrolls.push(options); } } }]);
      }
    };
  }
};
const location = {
  ...locationDefinition, data: { ...locationDefinition.data },
  setData(values) { Object.assign(this.data, values); }
};
global.getCurrentPages = () => [page, location];
(async () => {
  visible = false;
  page.onHide();
  location.locate();
  chooseLocation.success({ latitude: 39.7, longitude: 116.3, name: '新选位置' });
  chooseLocation.complete();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(page.data.locationText, '新选位置');
  assert.equal(page.data.locationIsFuzzy, false);
  assert.equal(requests.length, 1, '每次选点只刷新一次');
  assert.equal(requests[0].visible, true, '首页返回后才替换列表');
  assert.equal(scrollTop, 0, '换定位后不能将深分页的旧偏移留给新列表');
  assert.equal(requests[0].scrollTop, 0, '新位置列表请求前清除旧滚动位置');
  assert.equal(scrolls[0].animated, false, '位置切换不能带着旧列表执行回顶动画');
  assert.match(requests[0].path, /latitude=39.7&longitude=116.3/);
  assert.deepEqual(page.data.salonCards.map(card => card.id), ['nearby']);
  scrollTop = 200;
  page.onShow();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests.length, 1, '普通返回不重复刷新');
  assert.equal(scrollTop, 200, '普通返回保留浏览位置');
  location.locate();
  chooseLocation.fail();
  chooseLocation.complete();
  page.onShow();
  assert.equal(requests.length, 1, '取消选点不刷新');
  assert.equal(scrollTop, 200, '取消选点不改变浏览位置');
})().catch(error => { console.error(error); process.exitCode = 1; });
