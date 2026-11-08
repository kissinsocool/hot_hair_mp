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

const toasts = [];
global.wx.showToast = (options) => toasts.push(options);
const page = {
  ...pageDefinition,
  salons: [{ id: 'salon-1' }],
  data: { favorites: ['salon-1'], salonCards: [{ id: 'salon-1', isFavorite: true }] },
  setData(values) {
    Object.entries(values).forEach(([key, value]) => {
      const match = key.match(/^salonCards\[(\d+)\]\.isFavorite$/);
      if (match) this.data.salonCards[Number(match[1])].isFavorite = value;
      else this.data[key] = value;
    });
  }
};
const event = { currentTarget: { dataset: { id: 'salon-1' } } };

(async () => {
  await page.toggleFavorite(event);
  assert.deepEqual(page.data.favorites, []);
  assert.equal(page.data.salonCards[0].isFavorite, false);
  await page.toggleFavorite(event);
  assert.deepEqual(page.data.favorites, ['salon-1']);
  assert.equal(page.data.salonCards[0].isFavorite, true);
  assert.deepEqual(methods, ['DELETE', 'PUT'], '切换收藏后不再额外拉取收藏列表');
  assert.equal(toasts.length, 0);
})().catch((error) => {
  process.nextTick(() => { throw error; });
});
