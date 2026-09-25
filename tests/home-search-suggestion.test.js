const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

let pageDefinition;
let navigatedUrl;

global.getApp = () => ({
  globalData: { apiBaseUrl: 'https://example.com/api', mediaBaseUrl: '', session: null }
});
global.Page = (options) => { pageDefinition = options; };
global.wx = {
  getStorageSync: () => null,
  setStorageSync() {},
  request(options) { options.success({ statusCode: 200, data: {} }); },
  navigateTo({ url }) { navigatedUrl = url; }
};

const api = require('../utils/api');
require('../pages/home/home');

api.requestPage = async (requestPath) => {
  assert.match(requestPath, /keyword=%E7%9A%87%E4%BD%B3%E5%B0%8A%E8%8B%91%C2%B7%E6%8A%A4%E8%82%A4%E9%80%A0%E5%9E%8B$/);
  return {
    items: [{ id: '931870', name: '皇佳尊苑·护肤造型' }],
    hasMore: false
  };
};

const template = fs.readFileSync(path.join(__dirname, '../pages/home/home.wxml'), 'utf8');
assert.match(template, /class="suggestion"[^>]*data-id="{{item.id}}"/);

const page = {
  ...pageDefinition,
  data: {
    ...pageDefinition.data,
    salons: [
      { id: 'nearby', name: '附近店铺' },
      { id: '931870', name: '皇佳尊苑·护肤造型' }
    ],
    suggestions: [{ id: '931870', name: '皇佳尊苑·护肤造型' }]
  },
  setData(values) { Object.assign(this.data, values); }
};

(async () => {
  await page.chooseSuggestion({
    currentTarget: { dataset: { id: '931870', name: '皇佳尊苑·护肤造型' } }
  });

  assert.equal(navigatedUrl, undefined);
  assert.equal(page.data.keyword, '皇佳尊苑·护肤造型');
  assert.deepEqual(page.data.suggestions, []);
  assert.deepEqual(page.data.visibleSalons.map((salon) => salon.id), ['931870']);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
