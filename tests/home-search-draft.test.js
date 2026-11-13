const assert = require('node:assert/strict');

let pageDefinition;
global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api', mediaBaseUrl: '', session: null } });
global.Page = (options) => { pageDefinition = options; };
global.wx = { getStorageSync: () => null, request() {} };

const api = require('../utils/api');
const { applyData } = require('./support/setData');
require('../pages/home/home');

const paths = [];
api.requestPage = async (requestPath, { page }) => {
  paths.push(requestPath);
  return { items: [{ id: `salon-${page}`, name: page === 1 ? 'Alpha' : 'Beta' }], hasMore: page === 1 };
};

const page = {
  ...pageDefinition,
  data: { ...pageDefinition.data },
  setData(values, callback) { applyData(this.data, values); if (callback) callback(); }
};

(async () => {
  await page.loadSalons();
  // 输入了关键词但还没提交：继续下滑仍按当前（无关键词）列表翻页，已加载的卡片也不被过滤。
  page.onKeyword({ detail: { value: 'Alp' } });
  clearTimeout(page.searchTimer);
  await page.loadMore();
  assert.ok(paths.every((item) => !item.includes('keyword=')), paths.join('\n'));
  assert.deepEqual(page.data.salonCards.map((card) => card.id), ['salon-1', 'salon-2']);

  await page.submitSearch();
  assert.match(paths[paths.length - 1], /keyword=Alp$/);
  assert.equal(page.data.searchKeyword, 'Alp');

  // 清空未提交过的草稿不重新请求；清空已提交的关键词会恢复全部店铺。
  const before = paths.length;
  page.onKeyword({ detail: { value: '' } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(paths.length, before + 1);
  assert.equal(page.data.searchKeyword, '');
  page.onKeyword({ detail: { value: 'x' } });
  clearTimeout(page.searchTimer);
  page.onKeyword({ detail: { value: '' } });
  assert.equal(paths.length, before + 1);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
