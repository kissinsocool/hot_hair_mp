const assert = require('node:assert/strict');

let pageDefinition;

global.getApp = () => ({
  globalData: { apiBaseUrl: 'https://example.com/api', mediaBaseUrl: '', session: null }
});
global.Page = (options) => { pageDefinition = options; };
global.wx = { getStorageSync: () => null };

const api = require('../utils/api');
require('../pages/home/home');

assert.equal(pageDefinition.data.salonCards.length, 10);
assert.ok(pageDefinition.data.salonCards.every((card, index) => (
  card.isPlaceholder && card.cardKey === `salon-card-${index}`
)));

const page = {
  ...pageDefinition,
  data: {
    ...pageDefinition.data,
    salons: [{ id: 'salon-1', name: '店铺一', tags: [] }]
  },
  setData(values) { Object.assign(this.data, values); }
};

const normalized = page.normalizeSalon({ id: 'salon-2', name: '店铺二' });
assert.equal(normalized instanceof Promise, false);
assert.equal(normalized.image, '');
assert.equal(normalized.nameText, '店铺二');

page.applyFilter();

assert.equal(page.data.salonCards.length, 1);
assert.equal(page.data.salonCards[0].id, 'salon-1');
assert.equal(page.data.salonCards[0].isPlaceholder, false);
assert.equal(page.data.salonCards[0].cardKey, 'salon-card-0');

(async () => {
  const originalRequest = api.request;
  const originalDisplayImageUrl = api.displayImageUrl;
  api.request = async () => [{
    id: 'salon-cover',
    name: '封面测试店铺',
    image: '/cover.jpg',
    promoImages: ['/carousel.jpg']
  }];
  api.displayImageUrl = async (value) => `https://example.com${value}`;

  const loadingPage = {
    ...pageDefinition,
    data: { ...pageDefinition.data },
    setData(values) { Object.assign(this.data, values); }
  };

  try {
    await loadingPage.loadSalons();
    assert.equal(loadingPage.data.salonCards[0].image, 'https://example.com/cover.jpg');
  } finally {
    api.request = originalRequest;
    api.displayImageUrl = originalDisplayImageUrl;
  }
})().catch((error) => {
  process.nextTick(() => { throw error; });
});
