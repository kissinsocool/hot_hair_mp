const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

global.getApp = () => ({ globalData: { apiBaseUrl: 'https://api.hothaircc.cn/api', mediaBaseUrl: 'https://media.hothaircc.cn' } });
global.wx = {};
const api = require('../utils/api');
const { retryAsJpeg } = require('../utils/imageFallback');

const webp = api.thumbnailUrl('https://media.hothaircc.cn/a.jpg', 360, { webp: true });
const jpeg = api.thumbnailUrl('https://media.hothaircc.cn/a.jpg', 360);
const updates = [];
const page = {
  data: { reviews: [{ imageUrls: ['other', webp] }] },
  setData(values) { updates.push(values); Object.entries(values).forEach(() => { this.data.reviews[0].imageUrls[1] = jpeg; }); }
};
const error = (src, p = 'reviews[0].imageUrls[1]') => retryAsJpeg(page, { currentTarget: { dataset: { path: p, src } } });
error('stale-url');
assert.equal(updates.length, 0, 'a late error for a replaced image is ignored');
error(webp);
assert.deepEqual(updates, [{ 'reviews[0].imageUrls[1]': jpeg }]);
error(jpeg);
assert.equal(updates.length, 1, 'the JPEG thumbnail is not retried again');

// 启用 WebP 的图片都带上回退所需的路径和当前地址。
for (const file of ['pages/detail/detail.wxml', 'pages/salon-reviews/salon-reviews.wxml', 'pages/style-gallery/style-gallery.wxml',
  'pages/favorites/favorites.wxml', 'pages/staff/staff.wxml', 'components/salon-post-card/salon-post-card.wxml']) {
  const wxml = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const tags = wxml.match(/<image[^>]*webp="\{\{true\}\}"[^>]*>/g) || [];
  assert.ok(tags.length, file);
  for (const tag of tags) {
    assert.match(tag, /binderror="onImageError"/, tag);
    assert.match(tag, /data-path="[^"]+"/, tag);
    const src = tag.match(/ src="([^"]+)"/)[1];
    assert.ok(tag.includes(`data-src="${src}"`), tag);
  }
}
