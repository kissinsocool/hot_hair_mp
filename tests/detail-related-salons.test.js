const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

global.getApp = () => ({ globalData: {} });
let definition;
global.Page = value => { definition = value; };
require('../pages/detail/detail');
const api = require('../utils/api');
const createPage = () => ({
  ...definition,
  data: { ...definition.data, id: 'current' },
  setData(values) { Object.assign(this.data, values); }
});

test('nearby cards exclude current salon, keep list order and use shared images', async () => {
  api.requestPage = async (url, options) => {
    assert.equal(url, '/salons?latitude=31.2&longitude=121.6');
    assert.deepEqual(options, { page: 1, limit: 10 });
    return { items: [
      { id: 'current', name: '当前店铺' },
      { id: 'other/1', name: '其他店铺', coverImage: 'cover.jpg' },
      ...Array.from({ length: 10 }, (_, i) => ({ id: `salon-${i}`, name: `店铺${i}` }))
    ] };
  };
  api.displayImageUrl = async (value, width) => `${value}:${width}`;
  const page = createPage();
  await page.loadRelatedSalons({ geoLocation: { coordinates: [121.6, 31.2] } });
  assert.equal(page.data.relatedSalons.length, 9);
  assert.deepEqual(page.data.relatedSalons[0], {
    id: 'other/1', name: '其他店铺', image: 'cover.jpg:480',
    detailUrl: '/pages/detail/detail?id=other%2F1'
  });
  assert.ok(page.data.relatedSalons.every(item => item.id !== 'current'));
});

test('missing coordinates, empty lists and network failures leave the module hidden', async () => {
  const page = createPage();
  api.requestPage = async () => { throw new Error('must not request'); };
  await page.loadRelatedSalons({});
  api.requestPage = async () => ({ items: [{ id: 'current' }] });
  await page.loadRelatedSalons({ location: { latitude: 31.2, longitude: 121.6 } });
  assert.deepEqual(page.data.relatedSalons, []);
  api.requestPage = async () => { throw new Error('network unavailable'); };
  await page.loadRelatedSalons({ location: { latitude: 31.2, longitude: 121.6 } });
  assert.deepEqual(page.data.relatedSalons, []);
});

test('leaving detail before the list responds prevents a stale update', async () => {
  let resolve;
  api.requestPage = () => new Promise(done => { resolve = done; });
  const page = createPage();
  const loading = page.loadRelatedSalons({ location: { latitude: 31.2, longitude: 121.6 } });
  page.onUnload();
  resolve({ items: [{ id: 'other', name: '其他店铺' }] });
  await loading;
  assert.deepEqual(page.data.relatedSalons, []);
});

test('horizontal image-and-name cards sit directly before customer reviews', () => {
  const template = fs.readFileSync(path.join(__dirname, '../pages/detail/detail.wxml'), 'utf8');
  const start = template.indexOf('class="related-salons"');
  const end = template.indexOf('class="reviews-heading"');
  assert.ok(start > template.indexOf('店铺动态') && start < end);
  const section = template.slice(start, end);
  assert.match(section, /看了这个店铺的用户还看了/);
  assert.match(section, /scroll-x enhanced show-scrollbar="\{\{false\}\}"/);
  assert.match(section, /<navigator[^>]*url="\{\{item.detailUrl\}\}"/);
  assert.match(section, /class="related-salon-image" mode="aspectFill"/);
  assert.doesNotMatch(section, /更多|查看全部|もっと見る/);
});
