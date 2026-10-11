const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

test('salon detail shows at most ten reviews and links to the all-reviews page', () => {
  const root = path.join(__dirname, '..');
  const script = fs.readFileSync(path.join(root, 'pages/detail/detail.js'), 'utf8');
  const template = fs.readFileSync(path.join(root, 'pages/detail/detail.wxml'), 'utf8');
  const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));

  assert.match(script, /reviewCount:\s*10/);
  assert.match(script, /visibleReviews:\s*salon\.reviews\.slice\(0, this\.data\.reviewCount\)/);
  assert.match(script, /pages\/salon-reviews\/salon-reviews\?salonId=/);
  assert.match(template, /wx:if="\{\{salon\.reviews\.length > reviewCount\}\}"[^>]*bindtap="showAllReviews">查看更多<\/button>/);
  assert.ok(app.pages.includes('pages/salon-reviews/salon-reviews'));
});

test('all-reviews page loads the salon reviews and previews the selected image', async () => {
  let definition;
  const requests = [];
  const previews = [];
  global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api' } });
  global.Page = page => { definition = page; };
  global.wx = {
    previewImage: options => previews.push(options),
    stopPullDownRefresh() {}
  };
  const api = require('../utils/api');
  const original = { request: api.request, displayImageUrl: api.displayImageUrl };
  api.request = async url => {
    requests.push(url);
    return {
      reviews: [{
        id: 'review-1',
        userName: '顾客',
        avatarUrl: '/avatar.jpg',
        rating: 4.5,
        serviceName: '剪发',
        staffName: '小林',
        comment: '很满意',
        imageUrls: ['/one.jpg', '/two.jpg'],
        createdAt: '2026-09-24T10:00:00Z'
      }]
    };
  };
  api.displayImageUrl = async value => `https://example.com${value}`;

  try {
    require('../pages/salon-reviews/salon-reviews');
    const page = {
      ...definition,
      data: { ...definition.data },
      setData(values) { Object.assign(this.data, values); }
    };
    await page.onLoad({ salonId: 'salon/1' });
    assert.deepEqual(requests, ['/salons/salon%2F1']);
    assert.equal(page.data.reviews.length, 1);
    assert.equal(page.data.reviews[0].userText, '顾客');
    assert.equal(page.data.reviews[0].starIcons[4], '/assets/icons/star_half_gold.png');
    assert.equal(page.data.reviews[0].imageUrls[1], 'https://example.com/two.jpg');

    page.previewImage({ currentTarget: { dataset: { reviewIndex: 0, url: 'https://example.com/two.jpg' } } });
    assert.deepEqual(previews[0], {
      urls: ['https://example.com/one.jpg', 'https://example.com/two.jpg'],
      current: 'https://example.com/two.jpg'
    });
  } finally {
    api.request = original.request;
    api.displayImageUrl = original.displayImageUrl;
    delete global.getApp;
    delete global.Page;
    delete global.wx;
  }
});
