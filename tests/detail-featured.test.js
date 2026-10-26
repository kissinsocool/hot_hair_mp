const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const template = fs.readFileSync(path.join(root, 'pages/detail/detail.wxml'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'pages/detail/detail.wxss'), 'utf8');

global.getApp = () => ({ globalData: {} });
global.Page = definition => { global.definition = definition; };
require('../pages/detail/detail');
const definition = global.definition;
const api = require('../utils/api');
api.displayImageUrl = async value => value || '';
api.salonImage = salon => salon.image || '';

test('detail retains featured on/off and accepts released response without the field', async () => {
  for (const isFeatured of [true, false, undefined]) {
    const response = { id: 'salon-1', name: '测试店铺', services: [], staff: [], reviews: [], reviewCount: 0 };
    if (isFeatured !== undefined) response.isFeatured = isFeatured;
    api.request = async url => {
      assert.equal(url, '/salons/salon-1');
      return response;
    };
    const page = {
      ...definition,
      data: { ...definition.data, id: 'salon-1' },
      setData(value) { Object.assign(this.data, value); },
      loadFavoriteState() {},
    };
    await page.load();
    assert.equal(page.data.loading, false);
    assert.equal(page.data.salon.isFeatured, isFeatured);
    assert.equal(page.data.salon.name, '测试店铺');
  }
});

test('featured badge is conditional and sits below hero above salon heading', () => {
  const badge = template.indexOf('class="featured-badge"');
  assert.ok(template.indexOf('class="hero"') < badge);
  assert.ok(badge < template.indexOf('class="detail-heading"'));
  assert.match(template, /wx:if="\{\{salon\.isFeatured === true\}\}" class="featured-badge"><text>靓丝精选<\/text>/);
  assert.match(styles, /\.featured-badge\s*\{[^}]*border-radius:\s*10rpx;[^}]*background:\s*#151d25;[^}]*color:\s*#fff;/s);
});
