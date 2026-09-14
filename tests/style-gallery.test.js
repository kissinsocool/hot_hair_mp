const assert = require('node:assert/strict');

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
  const loading = page.onLoad({ category: 'men-cut' });
  assert.match(requests[0].url, /\/salons\/promoted-services\?category=men-cut&page=1&limit=30$/);
  requests[0].success({
    statusCode: 200,
    data: [{ id: 'image-1', salonId: 'salon/1', imageUrl: '/image.jpg' }],
    header: { 'X-Total-Count': '1' }
  });
  await loading;
  assert.equal(page.data.images[0].imageUrl, 'https://example.com/image.jpg');
  assert.equal(page.data.hasMore, false);
  page.openSalon({ currentTarget: { dataset: { salonId: 'salon/1' } } });
  assert.deepEqual(navigations, ['/pages/detail/detail?id=salon%2F1']);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
