const assert = require('node:assert/strict');
const { test } = require('node:test');

test('salon detail keeps the unrated label and count with five pink stars', async () => {
  let definition;
  global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api' } });
  global.Page = value => { definition = value; };
  global.wx = { showToast(options) { assert.fail(options.title); } };
  const api = require('../utils/api');
  const original = { request: api.request, displayImageUrl: api.displayImageUrl };
  api.displayImageUrl = async value => value;
  try {
    require('../pages/detail/detail');
    const page = {
      ...definition,
      data: { ...definition.data, id: 'salon-1' },
      setData(values) { Object.assign(this.data, values); },
      loadFavoriteState() {}
    };
    api.request = async () => ({ id: 'salon-1', rating: null, reviewCount: 0 });
    await page.load();
    assert.equal(page.data.salon.ratingText, '暂无评分');
    assert.equal(page.data.salon.hasRating, false);
    assert.equal(page.data.salon.rating, null);
    assert.equal(page.data.salon.reviewTotalText, 0);
    assert.deepEqual(page.data.salon.starIcons, Array(5).fill('/assets/icons/star_gold.png'));
    api.request = async () => ({ id: 'salon-1', rating: 3.5, reviewCount: 2 });
    await page.load();
    assert.equal(page.data.salon.ratingText, '3.5');
    assert.equal(page.data.salon.starIcons[3], '/assets/icons/star_half_gold.png');
    assert.equal(page.data.salon.starIcons[4], '/assets/icons/star_border_gold.png');
  } finally {
    Object.assign(api, original);
  }
});
