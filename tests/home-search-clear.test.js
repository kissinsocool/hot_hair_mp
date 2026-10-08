const assert = require('node:assert/strict');

let pageDefinition;
let suggestionRequest;

global.getApp = () => ({
  globalData: { apiBaseUrl: 'https://example.com/api', mediaBaseUrl: '', session: null }
});
global.Page = (options) => { pageDefinition = options; };
global.wx = {
  getStorageSync: () => null,
  request(options) { suggestionRequest = options; }
};

const api = require('../utils/api');
require('../pages/home/home');

api.requestPage = async (requestPath, options) => {
  assert.equal(requestPath, '/salons?latitude=39.9042&longitude=116.4074');
  assert.deepEqual(options, { page: 1, limit: 10 });
  return {
    items: [{ id: 'salon-1', name: 'Alpha' }, { id: 'salon-2', name: 'Beta' }],
    hasMore: false
  };
};

const page = {
  ...pageDefinition,
  data: {
    ...pageDefinition.data,
    salons: [{ id: 'salon-1', name: 'Alpha' }, { id: 'salon-2', name: 'Beta' }],
    keyword: 'Alpha',
    suggestions: [{ id: 'pending' }],
    visibleCount: 20
  },
  setData(values) { Object.assign(this.data, values); }
};

(async () => {
  const pendingSuggestions = page.loadSuggestions('Alpha');
  await page.clearSearch();

  assert.equal(page.data.keyword, '');
  assert.deepEqual(page.data.suggestions, []);
  assert.equal(page.data.visibleCount, 2);
  assert.deepEqual(page.data.visibleSalons.map((salon) => salon.id), ['salon-1', 'salon-2']);

  suggestionRequest.success({ statusCode: 200, data: [{ id: 'stale', name: 'Alpha stale' }] });
  await pendingSuggestions;
  assert.deepEqual(page.data.suggestions, []);
})().catch((error) => {
  process.nextTick(() => { throw error; });
});
