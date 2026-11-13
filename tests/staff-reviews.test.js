const assert = require('node:assert/strict');
const { applyData } = require('./support/setData');
const { test } = require('node:test');

test('staff page loads reviews from the paginated staff endpoint instead of the profile payload', async (t) => {
  let definition;
  const previews = [];
  const toasts = [];
  global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api' } });
  global.Page = page => { definition = page; };
  global.wx = { previewImage: value => previews.push(value), showToast: value => toasts.push(value) };
  const api = require('../utils/api');
  const original = { request: api.request, displayImageUrl: api.displayImageUrl };
  api.displayImageUrl = async value => `https://example.com${value}`;
  require('../pages/staff/staff');
  const createPage = () => ({
    ...definition, data: { ...definition.data },
    setData(values) { applyData(this.data, values); }
  });
  const profile = { id: 'staff/1', name: 'Tony', rating: 4.8, reviewCount: 12, salonName: '靓丝', salonServices: [] };
  const review = id => ({ id, userName: '顾客', rating: 5, imageUrls: [`/${id}.jpg`] });
  const pageOf = (items, hasMore = false) => ({ items, hasMore, total: 12 });
  const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
  const ids = page => page.data.reviews.map(item => item.id);
  try {
    await t.test('first page loads with the profile, then appends, deduplicates and stops at the end', async () => {
      const requests = [];
      api.request = async url => {
        requests.push(url);
        if (url === '/staff/staff/1') return { ...profile };
        return url.includes('page=1&')
          ? pageOf(Array.from({ length: 10 }, (_, i) => review(`review-${i}`)), true)
          : pageOf([review('review-9'), review('review-10'), review('review-11')]);
      };
      const page = createPage();
      await page.onLoad({ id: 'staff/1', salonId: 'salon-1' });
      assert.deepEqual(requests.slice().sort(), ['/staff/staff%2F1/reviews?page=1&limit=10', '/staff/staff/1']);
      assert.equal(page.data.staff.name, 'Tony');
      assert.equal('reviews' in page.data.staff, false);
      assert.equal(page.data.reviews.length, 10);
      assert.equal(page.data.reviews[0].userText, '顾客');
      assert.deepEqual(page.data.reviews[0].imageUrls, ['https://example.com/review-0.jpg']);
      assert.equal(page.data.hasMoreReviews, true);
      await page.onReachBottom();
      assert.equal(requests.at(-1), '/staff/staff%2F1/reviews?page=2&limit=10');
      assert.deepEqual(ids(page).slice(-3), ['review-9', 'review-10', 'review-11']);
      assert.equal(page.data.reviews.length, 12);
      assert.equal(page.data.hasMoreReviews, false);
      const total = requests.length;
      await page.onReachBottom();
      assert.equal(requests.length, total);
      page.previewReviewImage({ currentTarget: { dataset: { reviewIndex: 11, url: 'https://example.com/review-11.jpg' } } });
      assert.deepEqual(previews.at(-1), { urls: ['https://example.com/review-11.jpg'], current: 'https://example.com/review-11.jpg' });
    });

    await t.test('does not request the next page twice while one is loading', async () => {
      const next = deferred();
      let nextRequests = 0;
      api.request = async url => {
        if (!url.includes('/reviews')) return { ...profile };
        if (url.includes('page=2&')) { nextRequests++; return next.promise; }
        return pageOf([review('first')], true);
      };
      const page = createPage();
      await page.onLoad({ id: 'staff/1' });
      const pending = page.onReachBottom();
      assert.equal(page.data.loadingReviews, true);
      assert.equal(page.onReachBottom(), undefined);
      next.resolve(pageOf([review('second')]));
      await pending;
      assert.equal(nextRequests, 1);
      assert.deepEqual(ids(page), ['first', 'second']);
      assert.equal(page.data.loadingReviews, false);
    });

    await t.test('updates nothing after unload', async () => {
      const first = deferred();
      api.request = async url => url.includes('/reviews') ? first.promise : { ...profile };
      const page = createPage();
      const loading = page.onLoad({ id: 'staff/1' });
      page.onUnload();
      first.resolve(pageOf([review('stale')], true));
      await loading;
      assert.deepEqual(ids(page), []);
      assert.equal(page.data.loadingReviews, true);
    });

    await t.test('shows a retryable error for the first page and the next page', async () => {
      let fail = true;
      api.request = async url => {
        if (!url.includes('/reviews')) return { ...profile };
        if (fail) throw new Error('网络异常');
        return url.includes('page=1&') ? pageOf([review('first')], true) : pageOf([review('second')]);
      };
      const page = createPage();
      await page.onLoad({ id: 'staff/1' });
      assert.equal(page.data.reviewsError, '网络异常');
      assert.equal(page.data.loadingReviews, false);
      fail = false;
      await page.retryReviews();
      assert.deepEqual(ids(page), ['first']);
      assert.equal(page.data.reviewsError, '');
      fail = true;
      await page.onReachBottom();
      assert.equal(page.data.reviewsError, '网络异常');
      assert.deepEqual(ids(page), ['first']);
      fail = false;
      await page.retryReviews();
      assert.deepEqual(ids(page), ['first', 'second']);
      assert.equal(page.data.hasMoreReviews, false);
    });
  } finally {
    Object.assign(api, original);
    delete global.Page;
    delete global.wx;
    delete global.getApp;
  }
});
