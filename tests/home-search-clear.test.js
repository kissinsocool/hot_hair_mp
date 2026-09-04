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

require('../pages/home/home');

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
  page.clearSearch();

  assert.equal(page.data.keyword, '');
  assert.deepEqual(page.data.suggestions, []);
  assert.equal(page.data.visibleCount, 10);
  assert.deepEqual(page.data.visibleSalons.map((salon) => salon.id), ['salon-1', 'salon-2']);

  suggestionRequest.success({ statusCode: 200, data: [{ id: 'stale', name: 'Alpha stale' }] });
  await pendingSuggestions;
  assert.deepEqual(page.data.suggestions, []);
})().catch((error) => {
  process.nextTick(() => { throw error; });
});
