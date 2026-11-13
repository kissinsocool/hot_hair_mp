const assert = require('node:assert/strict');

let definition;
global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api', mediaBaseUrl: '', session: null } });
global.Page = (options) => { definition = options; };
global.wx = { getStorageSync: () => null, request() {} };
const api = require('../utils/api');
const { applyData } = require('./support/setData');
require('../pages/home/home');

// 服务端返回的搜索结果全部展示，即使店名里不含关键词（例如服务端按地址或商圈匹配）。
api.requestPage = async () => ({ items: [{ id: 'a', name: '格调美发', address: '朝阳路 1 号' }], hasMore: false });
const page = { ...definition, data: { ...definition.data }, setData(values, callback) { applyData(this.data, values); if (callback) callback(); } };
(async () => {
  page.setData({ keyword: '朝阳' });
  await page.submitSearch();
  assert.deepEqual(page.data.salonCards.map((card) => card.id), ['a']);
  assert.equal(page.data.salonCount, 1);
})().catch((error) => { console.error(error); process.exitCode = 1; });
