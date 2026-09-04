const assert = require('node:assert/strict');
const { ratingDisplay } = require('../utils/rating');

assert.deepEqual(ratingDisplay(null, 0), { hasRating: false, ratingText: '暂无评分' });
assert.deepEqual(ratingDisplay(4.8, 2), { hasRating: true, ratingText: '4.8' });
assert.deepEqual(ratingDisplay(4.8), { hasRating: false, ratingText: '暂无评分' });

let pageDefinition;
global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api' } });
global.Page = (options) => { pageDefinition = options; };
global.wx = { getStorageSync: () => null };

require('../pages/home/home');

pageDefinition.normalizeSalon({ id: 'salon-without-reviews', reviewCount: 0 }).then((salon) => {
  assert.equal(salon.ratingText, '暂无评分');
});
