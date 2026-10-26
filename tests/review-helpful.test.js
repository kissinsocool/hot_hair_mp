const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

test('review feedback waits for server success, deduplicates, retries and updates by identity', async () => {
  global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api' } });
  const toasts = [];
  global.wx = { showToast: value => toasts.push(value) };
  const api = require('../utils/api');
  const original = { request: api.request, requireLogin: api.requireLogin };
  const { markReviewHelpful } = require('../utils/reviewHelpful');
  const event = { currentTarget: { dataset: { bookingId: 'booking/1', reviewId: 'review-1' } } };
  const review = { bookingId: 'booking/1', id: 'review-1', helpful: false, helpfulCount: 2 };
  try {
    for (const listKey of ['visibleReviews', 'reviews']) {
      const page = { data: { [listKey]: [{ ...review }] }, setData(value) { Object.assign(this.data, value); } };
      let calls = 0;
      let finish;
      api.requireLogin = () => false;
      api.request = async () => { calls++; };
      await markReviewHelpful(page, listKey, event);
      assert.equal(calls, 0);
      api.requireLogin = () => true;
      api.request = (url, options) => {
        calls++;
        assert.equal(url, '/bookings/booking%2F1/review/helpful');
        assert.deepEqual(options, { method: 'POST', data: { reviewId: 'review-1' } });
        return new Promise(resolve => { finish = resolve; });
      };
      const pending = markReviewHelpful(page, listKey, event);
      assert.equal(page.data[listKey][0].helpful, false);
      assert.equal(page.data[listKey][0].helpfulSubmitting, true);
      await markReviewHelpful(page, listKey, event);
      assert.equal(calls, 1);
      // Pagination/refresh may change indexes while feedback is in flight.
      page.data[listKey] = [{ id: 'other' }, { ...review }];
      finish({ helpful: true, helpfulCount: 3 });
      await pending;
      assert.equal(page.data[listKey][0].helpful, undefined);
      assert.equal(page.data[listKey][1].helpful, true);
      assert.equal(page.data[listKey][1].helpfulCount, 2);
      await markReviewHelpful(page, listKey, event);
      assert.equal(calls, 1);

      page.data[listKey] = [{ ...review }];
      api.request = async () => { throw new Error('反馈失败'); };
      await markReviewHelpful(page, listKey, event);
      assert.equal(page.data[listKey][0].helpful, false);
      assert.equal(page.data[listKey][0].helpfulCount, 2);
      assert.equal(page.data[listKey][0].helpfulSubmitting, false);
      assert.equal(toasts.at(-1).title, '反馈失败');
      api.request = async () => ({ helpful: true, helpfulCount: 4 });
      await markReviewHelpful(page, listKey, event);
      assert.equal(page.data[listKey][0].helpfulCount, 2);

      page.data[listKey] = [{ ...review, helpfulCount: 0 }];
      await markReviewHelpful(page, listKey, event);
      assert.equal(page.data[listKey][0].helpful, true);
      assert.equal(page.data[listKey][0].helpfulCount, 0);

      page.data[listKey] = [{ ...review }];
      api.request = () => new Promise(resolve => { finish = resolve; });
      const unloading = markReviewHelpful(page, listKey, event);
      page.reviewFeedbackDisposed = true;
      page.setData = () => { throw new Error('must not update an unloaded page'); };
      finish({ helpful: true, helpfulCount: 5 });
      await unloading;
    }
  } finally {
    Object.assign(api, original);
    delete global.wx; delete global.getApp;
  }
});

test('re-entering either page resets the thank-you prompt and allows an idempotent request again', async () => {
  global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api' } });
  let definition;
  global.Page = value => { definition = value; };
  const api = require('../utils/api');
  const original = { request: api.request, requireLogin: api.requireLogin };
  let requests = 0;
  api.requireLogin = () => true;
  api.request = async () => { requests++; return { helpful: true, helpfulCount: 7 }; };
  const persisted = { id: 'review-1', bookingId: 'booking-1', helpful: true, helpfulCount: 7, imageUrls: [], createdAt: '2026-10-20T12:30:00' };
  const event = { currentTarget: { dataset: { bookingId: 'booking-1', reviewId: 'review-1' } } };
  try {
    for (const [name, listKey] of [['detail', 'visibleReviews'], ['salon-reviews', 'reviews']]) {
      require(`../pages/${name}/${name}`);
      for (let visit = 0; visit < 2; visit++) {
        const page = { ...definition, data: { ...definition.data }, setData(values) { Object.assign(this.data, values); } };
        const refreshedCount = 7 + visit;
        page.data[listKey] = [await page.normalizeReview({ ...persisted, helpfulCount: refreshedCount })];
        assert.equal(page.data[listKey][0].helpful, false);
        assert.equal(page.data[listKey][0].dateText, '2026年10月20日');
        assert.equal(page.data[listKey][0].helpfulCount, refreshedCount);
        const before = requests;
        await page.markReviewHelpful(event);
        assert.equal(requests, before + 1);
        assert.equal(page.data[listKey][0].helpful, true);
        assert.equal(page.data[listKey][0].helpfulCount, refreshedCount);
      }
    }
  } finally {
    Object.assign(api, original);
    delete global.Page; delete global.getApp;
  }
});

test('both card templates place dates below stars and helpful totals below images', () => {
  for (const name of ['detail', 'salon-reviews']) {
    const template = fs.readFileSync(path.join(__dirname, `../pages/${name}/${name}.wxml`), 'utf8');
    assert.ok(template.indexOf('class="review-rating-row"') < template.indexOf('class="review-date"'));
    assert.match(template, /\{\{item\.dateText\}\}发布评论/);
    assert.match(template, /bindtap="markReviewHelpful"/);
    assert.match(template, /感谢您提供反馈/);
    assert.ok(template.indexOf('class="review-images"') < template.indexOf('class="review-helpful-count"'));
    assert.match(template, /\{\{item\.helpfulCount\}\}位用户认为这个有帮助/);
    assert.match(template, /wx:if="\{\{item\.helpfulCount > 0\}\}" class="review-helpful-count"/);
  }
});
