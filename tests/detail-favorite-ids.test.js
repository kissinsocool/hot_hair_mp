const assert = require('node:assert/strict');
let definition;
let request;
global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api', session: { token: 'token' } } });
global.wx = { getStorageSync: () => null, request(options) { request = options; } };
global.Page = (value) => { definition = value; };
require('../pages/detail/detail');
const page = { ...definition, data: { ...definition.data, id: 'salon-1' }, setData(values) { Object.assign(this.data, values); } };
(async () => {
  let loading = page.loadFavoriteState();
  assert.equal(request.url, 'https://example.com/api/favorites/ids');
  request.success({ statusCode: 200, data: { salonIds: ['salon-1', 'salon-2'] } });
  await loading;
  assert.equal(page.data.isFavorite, true);
  loading = page.loadFavoriteState();
  request.success({ statusCode: 200, data: { salonIds: [] } });
  await loading;
  assert.equal(page.data.isFavorite, false);
})().catch((error) => { console.error(error); process.exitCode = 1; });
