const assert = require('node:assert/strict');

let pageDefinition;
const methods = [];
global.getApp = () => ({
  globalData: { apiBaseUrl: 'https://example.com/api', mediaBaseUrl: '' }
});
global.Page = (options) => { pageDefinition = options; };
global.wx = {
  getStorageSync(key) {
    return key === 'session' ? { token: 'token' } : null;
  },
  request(options) {
    methods.push(options.method);
    options.success({ statusCode: 200, data: [] });
  },
  showToast() {}
};

require('../pages/home/home');

const page = {
  data: { salons: [{ id: 'salon-1' }], favorites: ['salon-1'] },
  async loadFavorites() {}
};
const event = { currentTarget: { dataset: { id: 'salon-1' } } };

(async () => {
  await pageDefinition.toggleFavorite.call(page, event);
  page.data.favorites = [];
  await pageDefinition.toggleFavorite.call(page, event);
  assert.deepEqual(methods, ['DELETE', 'PUT']);
})().catch((error) => {
  process.nextTick(() => { throw error; });
});
