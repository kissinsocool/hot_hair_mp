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

require('../pages/home/home');

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

page.chooseSuggestion({
  currentTarget: { dataset: { id: '931870', name: '皇佳尊苑·护肤造型' } }
});

assert.equal(navigatedUrl, undefined);
assert.equal(page.data.keyword, '皇佳尊苑·护肤造型');
assert.deepEqual(page.data.suggestions, []);
assert.deepEqual(page.data.visibleSalons.map((salon) => salon.id), ['931870']);
