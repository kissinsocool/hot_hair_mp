const assert = require('node:assert/strict');
const { setTimeout: delay } = require('node:timers/promises');
const { test } = require('node:test');

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
assert.deepEqual(pageDefinition.data.visibleSalonCards, Array(10).fill(false));

const page = {
  ...pageDefinition,
  salons: [{ id: 'salon-1', name: '店铺一', tags: [] }],
  data: {
    ...pageDefinition.data
  },
  setData(values) { Object.assign(this.data, values); }
};

const normalized = page.normalizeSalon({ id: 'salon-2', name: '店铺二' });
assert.equal(normalized instanceof Promise, false);
assert.equal(normalized.image, '');
assert.equal(normalized.nameText, '店铺二');

page.renderSalons(page.salons);

assert.equal(page.data.salonCards.length, 1);
assert.equal(page.data.salonCards[0].id, 'salon-1');
assert.equal(page.data.salonCards[0].isPlaceholder, false);
assert.equal(page.data.salonCards[0].cardKey, 'salon-card-0');
assert.deepEqual(page.data.salonCards[0].images, [''], 'a salon without images keeps one placeholder tile');
assert.equal(page.data.salonCards[0].reviewCountText, undefined, 'cards only show what normalizeSalon prepared');

const reviewed = page.normalizeSalon({ id: 'salon-3', address: '测试路 1 号', rating: 4.8, reviewCount: 707, images: ['/raw.jpg'], cutPriceFromFen: 495000 });
assert.equal(reviewed.reviewCountText, '评价 707条');
assert.deepEqual(reviewed.cardImages, []);
assert.equal(page.normalizeSalon({ reviewCount: 0 }).reviewCountText, '暂无评价');
page.renderSalons([reviewed]);
assert.equal(page.data.salonCards[0].reviewCountText, '评价 707条');
assert.equal(page.data.salonCards[0].addressText, '测试路 1 号');
assert.equal(page.data.salonCards[0].cutPriceText, '剪发 ¥ 4,950～');
assert.equal(page.normalizeSalon({ cutPriceFromFen: 6850 }).cutPriceText, '剪发 ¥ 68.50～');
for (const cutPriceFromFen of [undefined, null, 0, -1, '6800', 68.5]) {
  assert.equal(page.normalizeSalon({ cutPriceFromFen }).cutPriceText, '', 'the item is hidden without a valid price');
}
assert.deepEqual(
  api.salonImages({ image: '/cover.jpg', promoImages: ['/a.jpg', '/cover.jpg', '', null], images: ['/b.jpg', '/c.jpg'] }, 3),
  ['/cover.jpg', '/a.jpg', '/b.jpg']
);
assert.deepEqual(api.salonImages({}, 5), []);

test('home batches visibility by card position across replacement, pagination and unload', async () => {
  const callbacks = [];
  const updates = [];
  let disconnects = 0;
  const observerPage = {
    ...pageDefinition,
    data: { ...pageDefinition.data, salonCards: [], visibleSalonCards: [] },
    setData(values, callback) {
      updates.push(values);
      for (const [key, value] of Object.entries(values)) {
        const indexPath = key.match(/^(visibleSalonCards|salonCards)\[(\d+)\]$/);
        if (indexPath) this.data[indexPath[1]][Number(indexPath[2])] = value;
        else this.data[key] = value;
      }
      if (callback) callback();
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
          callbacks.push((index, intersectionRatio) => callback({
            dataset: { cardIndex: index }, intersectionRatio
          }));
        },
        disconnect() { disconnects++; }
      };
    }
  };

  observerPage.renderSalons([{ id: 'one' }, { id: 'two' }]);
  const [intersect] = callbacks;
  updates.length = 0;
  intersect(0, 1);
  intersect(1, 1);
  intersect(0, 0);
  intersect(0, 1);
  assert.deepEqual(updates, []);
  await delay(25);
  assert.deepEqual(updates, [{ 'visibleSalonCards[0]': true, 'visibleSalonCards[1]': true }]);

  intersect(0, 0);
  intersect(0, 1);
  await delay(25);
  assert.equal(updates.length, 1, 'a net unchanged position does not write data');

  observerPage.renderSalons([{ id: 'three' }, { id: 'four' }]);
  assert.deepEqual(observerPage.data.visibleSalonCards, [true, true]);
  assert.equal(callbacks.length, 1);
  assert.equal(disconnects, 0);

  intersect(0, 0);
  observerPage.renderSalons([{ id: 'three' }]);
  assert.deepEqual(observerPage.data.visibleSalonCards, [false]);
  observerPage.renderSalons([{ id: 'five' }], true);
  assert.deepEqual(observerPage.data.visibleSalonCards, [false, false]);
  assert.equal(disconnects, 2);

  const appendedIntersection = callbacks[2];
  updates.length = 0;
  intersect(1, 1);
  await delay(25);
  assert.deepEqual(updates, [], 'a callback from a disconnected observer cannot update an added card');
  appendedIntersection(1, 1);
  await delay(25);
  assert.deepEqual(observerPage.data.visibleSalonCards, [false, true]);

  updates.length = 0;
  appendedIntersection(1, 0);
  observerPage.onUnload();
  appendedIntersection(0, 1);
  await delay(25);
  assert.deepEqual(updates, []);
  assert.equal(disconnects, 3);
});

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
    assert.deepEqual(loadingPage.data.salonCards[0].images, ['https://example.com/cover.jpg', 'https://example.com/carousel.jpg']);
  } finally {
    api.request = originalRequest;
    api.requestPage = originalRequestPage;
    api.displayImageUrl = originalDisplayImageUrl;
  }
})().catch((error) => {
  process.nextTick(() => { throw error; });
});
