const assert = require('node:assert/strict');
const test = require('node:test');

global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api', mediaBaseUrl: '', session: null } });
global.wx = { getStorageSync: () => null, request() {}, showToast() {} };
let definition;
global.Page = (options) => { definition = options; };
const api = require('../utils/api');
const { applyData } = require('./support/setData');
require('../pages/home/home');

const flush = () => new Promise(setImmediate);
let pending;
const cachedLists = [];
global.wx.setStorage = ({ key, data }) => {
  if (key === 'homeSalonListCache') cachedLists.push(data);
};
api.requestPage = (path, { page }) => new Promise((resolve, reject) => pending.push({ path, page, resolve, reject }));
const respond = (request, ids, hasMore) => request.resolve({ items: ids.map((id) => ({ id, name: id })), hasMore });
const describe = () => pending.map((p) => `${p.path.includes('keyword=x') ? 'new' : 'old'}:${p.page}`);

// 先加载到第 3 页。
async function pageWithThreePages() {
  pending = [];
  const page = { ...definition, data: { ...definition.data }, setData(v, cb) { applyData(this.data, v); if (cb) cb(); } };
  page.loadSalons(); respond(pending.shift(), ['a1', 'a2'], true); await flush();
  page.loadMore(); respond(pending.shift(), ['a3'], true); await flush();
  page.loadMore(); respond(pending.shift(), ['a4'], true); await flush();
  assert.equal(page.data.salonPage, 3);
  return page;
}

test('scrolling to the bottom while a new search is loading does not request a page of the new query', async () => {
  const page = await pageWithThreePages();
  page.setData({ keyword: 'x' });
  page.submitSearch();
  page.loadMore();
  assert.deepEqual(describe(), ['new:1'], 'only the first page of the new search is requested');
  respond(pending.shift(), ['x1'], true); await flush();
  assert.deepEqual(page.data.salonCards.map((card) => card.id), ['x1']);
  // 新列表替换完成后恢复正常翻页，从新查询的第 2 页继续。
  page.loadMore();
  assert.deepEqual(describe(), ['new:2']);
  respond(pending.shift(), ['x2'], false); await flush();
  assert.deepEqual(page.data.salonCards.map((card) => card.id), ['x1', 'x2']);
});

test('a page request already in flight is discarded when a new search starts', async () => {
  const page = await pageWithThreePages();
  page.loadMore();
  const stalePage = pending.shift();
  page.setData({ keyword: 'x' });
  page.submitSearch();
  respond(pending.shift(), ['x1'], true); await flush();
  respond(stalePage, ['a5'], true); await flush();
  assert.deepEqual(page.data.salonCards.map((card) => card.id), ['x1']);
});

test('after a failed new search the old list stays but is not paged with the new query', async () => {
  const page = await pageWithThreePages();
  page.setData({ keyword: 'x' });
  page.submitSearch();
  pending.shift().reject(new Error('网络连接失败')); await flush();
  assert.deepEqual(page.data.salonCards.map((card) => card.id), ['a1', 'a2', 'a3', 'a4']);
  page.loadMore();
  assert.deepEqual(describe(), []);
});

test('pull-to-refresh in progress also blocks paging until the first page is replaced', async () => {
  const page = await pageWithThreePages();
  page.refresh();
  page.loadMore();
  assert.deepEqual(describe(), ['old:1']);
  respond(pending.shift(), ['r1'], true); await flush();
  page.loadMore();
  assert.deepEqual(describe(), ['old:2']);
});

test('after the location changes, reaching the bottom before the reload starts does not page with the new coordinates', async () => {
  const page = await pageWithThreePages();
  // 手动选点：坐标立即更新，第 1 页请求要等首页回到前台、滚动回顶的异步回调之后才发起。
  page.applySelectedLocation({ latitude: 22.54, longitude: 114.06, name: '深圳湾' });
  page.loadMore();
  assert.deepEqual(pending, [], 'no page of the old list is requested with the new coordinates');
  // 模糊定位返回、位置变化时同理。
  page.setData({ latitude: 31.2, longitude: 121.5 });
  page.loadMore();
  assert.deepEqual(pending, []);
  page.loadSalons();
  assert.equal(pending.length, 1);
  assert.equal(pending[0].page, 1);
  assert.match(pending[0].path, /latitude=31.2&longitude=121.5/);
  respond(pending.shift(), ['n1'], true); await flush();
  page.loadMore();
  assert.equal(pending[0].page, 2);
  assert.match(pending[0].path, /latitude=31.2&longitude=121.5/);
});

test('an old first page arriving after a location change cannot replace or cache the list', async () => {
  const page = await pageWithThreePages();
  cachedLists.length = 0;
  const oldLoad = page.loadSalons();
  const oldRequest = pending.shift();
  page.applySelectedLocation({ latitude: 22.54, longitude: 114.06, name: '深圳湾' });
  respond(oldRequest, ['old-location'], true);
  await oldLoad;
  assert.deepEqual(page.data.salonCards.map((card) => card.id), ['a1', 'a2', 'a3', 'a4']);
  assert.deepEqual(cachedLists, []);

  const newLoad = page.loadSalons();
  respond(pending.shift(), ['new-location'], false);
  await newLoad;
  assert.deepEqual(page.data.salonCards.map((card) => card.id), ['new-location']);
  assert.equal(cachedLists.length, 1);
  assert.deepEqual(cachedLists[0].location, { latitude: 22.54, longitude: 114.06 });
  assert.equal(cachedLists[0].items[0].id, 'new-location');
});
