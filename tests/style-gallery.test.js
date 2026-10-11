const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

let pageDefinition;
const requests = [];
const navigations = [];
global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api', mediaBaseUrl: '' } });
global.Page = (options) => { pageDefinition = options; };
global.wx = {
  getStorageSync() { return null; },
  setNavigationBarTitle(options) { assert.equal(options.title, '男士精剪'); },
  navigateTo(options) { navigations.push(options.url); },
  request(options) { requests.push(options); }
};

require('../pages/style-gallery/style-gallery');

const page = {
  ...pageDefinition,
  data: { ...pageDefinition.data },
  setData(values) { Object.assign(this.data, values); }
};

(async () => {
  const loading = page.onLoad({ category: 'men-cut', latitude: '39', longitude: '116' });
  assert.match(requests[0].url, /\/salons\/promoted-services\?category=men-cut&sort=latest&page=1&limit=30$/);
  requests[0].success({
    statusCode: 200,
    data: [{ id: 'image-1', salonId: 'salon/1', imageUrl: '/image.jpg' }],
    header: { 'X-Total-Count': '1' }
  });
  await loading;
  assert.equal(page.data.images[0].imageUrl, 'https://example.com/image.jpg');
  assert.equal(page.data.hasMore, false);

  const sorting = page.changeSort({ currentTarget: { dataset: { sort: 'distance' } } });
  assert.match(requests[1].url, /\/salons\/promoted-services\?category=men-cut&sort=distance&latitude=39&longitude=116&page=1&limit=30$/);
  requests[1].success({
    statusCode: 200,
    data: [{ id: 'image-2', salonId: 'salon-2', imageUrl: '/nearby.jpg' }],
    header: { 'X-Total-Count': '1' }
  });
  await sorting;
  assert.equal(page.data.images[0].id, 'image-2');

  page.openSalon({ currentTarget: { dataset: { salonId: 'salon/1' } } });
  assert.deepEqual(navigations, ['/pages/detail/detail?id=salon%2F1']);

  const template = fs.readFileSync(path.join(__dirname, '../pages/style-gallery/style-gallery.wxml'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '../pages/style-gallery/style-gallery.wxss'), 'utf8');
  assert.match(template, />最新发布<\/view>/);
  assert.match(template, />离我最近<\/view>/);
  assert.match(styles, /\.gallery-sort\s*\{[^}]*width:\s*33\.333%;[^}]*margin:\s*16rpx 24rpx 16rpx auto;/s);
  assert.match(styles, /\.gallery-sort-option\.active\s*\{[^}]*background:\s*#403937;/s);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
