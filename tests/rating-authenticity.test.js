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

const salon = pageDefinition.normalizeSalon({ id: 'salon-without-reviews', reviewCount: 0 });
assert.equal(salon.ratingText, '暂无评分');

assert.deepEqual(ratingDisplay(5, 1), { hasRating: true, ratingText: '5' });
assert.deepEqual(ratingDisplay(4.67, 3), { hasRating: true, ratingText: '4.67' });
assert.deepEqual(ratingDisplay(4.333, 3), { hasRating: true, ratingText: '4.33' });
assert.deepEqual(ratingDisplay(4.86, 7), { hasRating: true, ratingText: '4.86' });
