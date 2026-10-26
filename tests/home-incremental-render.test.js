const assert = require('node:assert/strict');
let definition;
global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api', session: { token: 'token' } } });
global.wx = { getStorageSync: () => null, showToast() {} };
global.Page = (value) => { definition = value; };
const api = require('../utils/api');
require('../pages/home/home');
const writes = [];
const page = {
  ...definition, data: structuredClone(definition.data),
  setData(values, callback) {
    writes.push(values);
    for (const [key, value] of Object.entries(values)) {
      const match = key.match(/^(salonCards|recommendedPackages)\[(\d+)\](?:\.(\w+))?$/);
      if (!match) this.data[key] = value;
      else if (match[3]) this.data[match[1]][Number(match[2])][match[3]] = value;
      else this.data[match[1]][Number(match[2])] = value;
    }
    if (callback) callback();
  }
};
api.requestPage = async (_path, { page }) => ({ items: Array.from({ length: 10 }, (_, i) => ({ id: `salon-${page}-${i}`, name: '店铺', tags: [], unusedDetails: '不渲染的门店详情' })), hasMore: true });
(async () => {
  await page.loadSalons();
  for (let i = 0; i < 9; i += 1) await page.loadMore();
  assert.equal(page.data.salonCards.length, 100);
  writes.length = 0;
  await page.loadMore();
  const appended = writes.flatMap((value) => Object.keys(value).filter((key) => /^salonCards\[\d+\]$/.test(key)));
  assert.equal(appended.length, 10, '翻页只传输新增十张卡片');
  assert.ok(writes.every((value) => !['salons', 'filteredSalons', 'visibleSalons', 'salonCards'].some((key) => key in value)), '翻页不传累计数组');
  assert.equal(page.data.salonCards.length, 110);
  assert.ok(page.data.salonCards.every((card) => !('unusedDetails' in card)), '卡片只传模板使用字段');
  writes.length = 0;
  page.data.recommendedPackages = [{ salonId: 'salon-1-0', isFavorite: false }];
  api.request = async () => ({ salonIds: ['salon-1-0'] });
  await page.loadFavorites();
  assert.equal(page.data.salonCards[0].isFavorite, true);
  assert.ok(writes.some((value) => value['salonCards[0].isFavorite'] === true));
  assert.ok(writes.every((value) => !('salonCards' in value)), '收藏仅更新变化字段');
  assert.equal(page.data.recommendedPackages[0].isFavorite, true);
  writes.length = 0;
  await page.loadFavorites();
  assert.ok(writes.every((value) => Object.keys(value).every((key) => !key.startsWith('salonCards') && !key.startsWith('recommendedPackages'))), '未改变的收藏不重传卡片');
  let finishOldPage;
  api.requestPage = (_path, { page: number }) => number > 1
    ? new Promise((resolve) => { finishOldPage = resolve; })
    : Promise.resolve({ items: [{ id: 'fresh', name: '新列表', tags: [] }], hasMore: false });
  const oldPage = page.loadMore();
  await page.loadSalons();
  finishOldPage({ items: [{ id: 'stale', name: '旧分页', tags: [] }], hasMore: true });
  await oldPage;
  assert.deepEqual(page.data.salonCards.map((card) => card.id), ['fresh'], '刷新后迟到分页不能追加旧卡片');
  assert.equal(page.data.salonCount, 1);
  writes.length = 0;
  api.requestPage = async () => { throw new Error('网络请求失败'); };
  await page.loadSalons();
  assert.equal(page.data.salonCards[0].id, 'fresh', '失败保留已有列表');
  assert.ok(writes.every((value) => !('salonCards' in value)), '失败不重传累计卡片');
  api.requestPage = async () => ({ items: [], hasMore: false });
  await page.loadSalons();
  assert.deepEqual(page.data.salonCards, [], '刷新清除旧列表');
})().catch((error) => { console.error(error); process.exitCode = 1; });
