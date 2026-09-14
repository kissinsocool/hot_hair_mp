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
  card.isPlaceholder && !card.lightActive && card.cardKey === `salon-card-${index}`
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

let intersectionCallback;
const observerPage = {
  ...page,
  data: {
    ...page.data,
    salonCards: [{ ...page.data.salonCards[0], lightActive: false }]
  },
  setData(values) {
    Object.entries(values).forEach(([key, value]) => {
      const match = key.match(/^salonCards\[(\d+)\]\.lightActive$/);
      if (match) this.data.salonCards[Number(match[1])].lightActive = value;
      else this.data[key] = value;
    });
  },
  createIntersectionObserver(options) {
    assert.deepEqual(options, { observeAll: true, thresholds: [0, 0.01] });
    return {
      relativeTo(selector) {
        assert.equal(selector, '.list');
        return this;
      },
      observe(selector, callback) {
        assert.equal(selector, '.salon-card');
        intersectionCallback = callback;
      },
      disconnect() {}
    };
  }
};

observerPage.observeSalonCards();
intersectionCallback({ dataset: { cardIndex: 0 }, intersectionRatio: 1 });
assert.equal(observerPage.data.salonCards[0].lightActive, true);
intersectionCallback({ dataset: { cardIndex: 0 }, intersectionRatio: 0 });
assert.equal(observerPage.data.salonCards[0].lightActive, false);

(async () => {
  const originalRequest = api.request;
  const originalRequestPage = api.requestPage;
  const originalDisplayImageUrl = api.displayImageUrl;
  api.requestPage = async () => ({
    items: [{
      id: 'salon-cover',
      name: '封面测试店铺',
      image: '/cover.jpg',
      promoImages: ['/carousel.jpg']
    }],
    hasMore: false
  });
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
    api.requestPage = originalRequestPage;
    api.displayImageUrl = originalDisplayImageUrl;
  }
})().catch((error) => {
  process.nextTick(() => { throw error; });
});
