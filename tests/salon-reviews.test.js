const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

test('salon detail shows at most three reviews and only links to all reviews from the heading', () => {
  const root = path.join(__dirname, '..');
  const script = fs.readFileSync(path.join(root, 'pages/detail/detail.js'), 'utf8');
  const template = fs.readFileSync(path.join(root, 'pages/detail/detail.wxml'), 'utf8');
  const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));

  assert.match(script, /reviewCount:\s*3/);
  assert.match(script, /visibleReviews:\s*salon\.reviews\.slice\(0, this\.data\.reviewCount\)/);
  assert.match(script, /pages\/salon-reviews\/salon-reviews\?salonId=/);
  assert.match(template, /<view class="reviews-heading">\s*<view class="section-title">客户评价（\{\{salon\.reviewTotalText\}\}）<\/view>\s*<view wx:if="\{\{salon\.reviewCount > 0\}\}" class="reviews-all" bindtap="showAllReviews" aria-role="button">\s*<text>查看全部<\/text>\s*<view class="reviews-all-arrow" aria-hidden="true"><\/view>\s*<\/view>\s*<\/view>/);
  assert.equal((template.match(/bindtap="showAllReviews"/g) || []).length, 1);
  assert.ok(app.pages.includes('pages/salon-reviews/salon-reviews'));
});

test('reviews use server pagination and counts without stale requests changing the selected filter', async (t) => {
  let definition;
  const previews = [];
  let refreshStopped = 0;
  global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api' } });
  global.Page = page => { definition = page; };
  global.wx = { previewImage: value => previews.push(value), stopPullDownRefresh: () => refreshStopped++ };
  const api = require('../utils/api');
  const original = { request: api.request, displayImageUrl: api.displayImageUrl };
  api.displayImageUrl = async value => `https://example.com${value}`;
  require('../pages/salon-reviews/salon-reviews');
  const createPage = () => ({
    ...definition, data: { ...definition.data, salonId: 'salon/1' },
    setData(values) { Object.assign(this.data, values); }
  });
  const review = id => ({ id, userName: '顾客', rating: 4.5, imageUrls: [`/${id}.jpg`], createdAt: '2026-09-24T10:00:00Z' });
  const counts = { all: 160, negative: 12, neutral: 23, photos: 41 };
  const reviewTags = [{ name: '善于沟通', count: 83 }, { name: '环境舒适', count: 82 }];
  const result = (items, hasMore = false) => ({ items, hasMore, counts, reviewTags });
  const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
  const ids = page => page.data.reviews.map(item => item.id);
  try {
    await t.test('loads ten at a time, appends, deduplicates and stops at the end', async () => {
      const requests = [];
      api.request = async url => {
        requests.push(url);
        return url.includes('page=1&')
          ? result(Array.from({ length: 10 }, (_, i) => review(`review-${i}`)), true)
          : result([review('review-9'), review('review-10')]);
      };
      const page = createPage();
      await page.onLoad({ salonId: 'salon/1' });
      assert.equal(requests[0], '/salons/salon%2F1/reviews?filter=latest&page=1&limit=10');
      assert.equal(page.data.reviews.length, 10);
      assert.equal(page.data.reviews[0].userText, '顾客');
      assert.equal(page.data.reviews[0].starIcons[4], '/assets/icons/star_half_gold.png');
      assert.deepEqual(page.data.counts, counts);
      assert.deepEqual(page.data.reviewTags, reviewTags);
      await page.onReachBottom();
      assert.equal(requests[1], '/salons/salon%2F1/reviews?filter=latest&page=2&limit=10');
      assert.equal(page.data.reviews.length, 11);
      assert.deepEqual(page.data.reviewTags, reviewTags);
      await page.loadMore();
      assert.equal(requests.length, 2);
      page.previewImage({ currentTarget: { dataset: { reviewIndex: 10, url: 'https://example.com/review-10.jpg' } } });
      assert.deepEqual(previews.at(-1), { urls: ['https://example.com/review-10.jpg'], current: 'https://example.com/review-10.jpg' });
    });
    await t.test('filters request page one and retain whole-salon counts, including empty categories', async () => {
      const requests = [];
      api.request = async url => { requests.push(url); return result(url.includes('filter=neutral') ? [] : [review('selected')]); };
      const page = createPage();
      await page.load();
      await page.changeFilter({ currentTarget: { dataset: { filter: 'negative' } } });
      assert.equal(requests.at(-1), '/salons/salon%2F1/reviews?filter=negative&page=1&limit=10');
      assert.deepEqual(ids(page), ['selected']);
      assert.deepEqual(page.data.counts, counts);
      await page.changeFilter({ currentTarget: { dataset: { filter: 'neutral' } } });
      assert.deepEqual(ids(page), []);
      await page.onPullDownRefresh();
      assert.equal(page.data.filter, 'neutral');
      assert.equal(refreshStopped, 1);
      const total = requests.length;
      await page.changeFilter({ currentTarget: { dataset: { filter: 'neutral' } } });
      await page.changeFilter({ currentTarget: { dataset: { filter: 'unknown' } } });
      assert.equal(requests.length, total);
      await page.changeFilter({ currentTarget: { dataset: { filter: 'photos' } } });
      assert.equal(requests.at(-1), '/salons/salon%2F1/reviews?filter=photos&page=1&limit=10');
      assert.deepEqual(page.data.counts, counts);
      assert.deepEqual(ids(page), ['selected']);
      await page.changeFilter({ currentTarget: { dataset: { filter: 'latest' } } });
      assert.equal(requests.at(-1), '/salons/salon%2F1/reviews?filter=latest&page=1&limit=10');
      assert.deepEqual(page.data.reviewTags, reviewTags);
    });
    await t.test('ignores old page results after filter changes and prevents duplicate next-page requests', async () => {
      const old = deferred();
      const page = createPage();
      api.request = async url => url.includes('page=2&') ? old.promise : result([review(url.includes('negative') ? 'negative' : 'latest')], true);
      await page.load();
      const pending = page.loadMore();
      assert.equal(page.data.loadingMore, true);
      assert.equal(page.loadMore(), undefined);
      await page.changeFilter({ currentTarget: { dataset: { filter: 'negative' } } });
      old.resolve(result([review('stale')]));
      await pending;
      assert.deepEqual(ids(page), ['negative']);
      assert.equal(page.data.page, 1);
      assert.equal(page.data.hasMore, true);
      assert.equal(page.data.loadingMore, false);
    });
    await t.test('ignores old first-page and image results, and updates nothing after unload', async () => {
      const old = deferred();
      const page = createPage();
      api.request = async url => url.includes('filter=latest') ? old.promise : result([review('neutral')]);
      const pending = page.load();
      await page.changeFilter({ currentTarget: { dataset: { filter: 'neutral' } } });
      old.resolve(result([review('stale')]));
      await pending;
      assert.deepEqual(ids(page), ['neutral']);
      const images = deferred();
      api.displayImageUrl = () => images.promise;
      api.request = async () => result([review('unloaded')]);
      const loading = page.load();
      await new Promise(resolve => setImmediate(resolve));
      page.onUnload();
      images.resolve('/image.jpg');
      await loading;
      assert.deepEqual(ids(page), []);
      api.displayImageUrl = original.displayImageUrl;
    });
    await t.test('first-page and next-page failures can be retried without skipping pages', async () => {
      const page = createPage();
      api.request = async () => { throw new Error('加载失败'); };
      await page.load();
      assert.equal(page.data.errorMessage, '加载失败');
      assert.equal(page.data.loading, false);
      api.request = async () => result([{ id: 'first', imageUrls: [] }], true);
      await page.load();
      api.request = async () => { throw new Error('下一页失败'); };
      await page.loadMore();
      assert.deepEqual(ids(page), ['first']);
      assert.equal(page.data.page, 1);
      assert.equal(page.data.loadMoreError, '下一页失败');
      api.request = async url => { assert.ok(url.includes('page=2&')); return result([{ id: 'next', imageUrls: [] }]); };
      await page.loadMore();
      assert.deepEqual(ids(page), ['first', 'next']);
      assert.equal(page.data.loadMoreError, '');
      const invalid = createPage(); invalid.data.salonId = '';
      await invalid.load();
      assert.equal(invalid.data.errorMessage, '店铺信息无效');
    });
    const template = fs.readFileSync(path.join(__dirname, '../pages/salon-reviews/salon-reviews.wxml'), 'utf8');
    assert.match(template, /差评<text wx:if="\{\{counts\}\}">（\{\{counts\.negative\}\}）/);
    assert.match(template, /中评<text wx:if="\{\{counts\}\}">（\{\{counts\.neutral\}\}）/);
    assert.match(template, /全部<text wx:if="\{\{counts\}\}">（\{\{counts\.all\}\}）/);
    assert.match(template, /晒图<text wx:if="\{\{counts\}\}">（\{\{counts\.photos\}\}）/);
    assert.deepEqual([...template.matchAll(/data-filter="([^"]+)"/g)].map(match => match[1]), ['latest', 'neutral', 'negative', 'photos']);
    assert.match(template, /wx:if="\{\{filter === 'latest' && !loading && !errorMessage && reviewTags\.length\}\}" class="review-tag-summary"/);
    assert.match(template, /wx:for="\{\{reviewTags\}\}" wx:key="name" class="review-tag-count">\{\{item\.name\}\}（\{\{item\.count\}\}）/);
    assert.ok(template.indexOf('class="review-tag-summary"') < template.indexOf('class="review-list"'));
  } finally {
    Object.assign(api, original);
    delete global.getApp; delete global.Page; delete global.wx;
  }
});
