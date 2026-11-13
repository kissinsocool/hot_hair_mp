const assert = require('node:assert/strict');
const test = require('node:test');
const { REVIEW_RATING_FIELDS, reviewRatingAverage } = require('../utils/reviewRatings');

const ratings = { environment: 5, technique: 4, service: 3, price: 5 };
test('four independent integer scores produce an exact average only when complete', () => {
  assert.deepEqual(REVIEW_RATING_FIELDS.map(field => field.label), ['店内环境', '接待服务', '技术·完成效果', '套餐价格']);
  assert.equal(reviewRatingAverage(ratings), 4.25);
  for (const price of [undefined, 0, 6, 2.5, '5']) {
    assert.equal(reviewRatingAverage({ ...ratings, price }), 0);
  }
});

test('the shared editor preserves create, edit, complaint and image request contracts', async () => {
  let definition;
  let component;
  const requests = [];
  const notices = [];
  let backs = 0;
  global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api' } });
  global.Page = value => { definition = value; };
  global.Component = value => { component = value; };
  global.wx = {
    getStorageSync: key => key === 'session' ? { token: 'token', user: {} } : null,
    removeStorageSync() {}, showToast: value => notices.push(value.title),
    setNavigationBarTitle() {}, navigateBack() { backs++; }
  };
  const api = require('../utils/api');
  const originalRequest = api.request;
  const originalUpload = api.uploadFile;
  api.request = async (url, options) => {
    requests.push({ url, ...options });
    if (url === '/uploads/moderation/sign') return { uploads: [{ objectName: 'reviews/new.jpg', uploadUrl: 'https://example.com/upload', fields: {} }] };
    return {};
  };
  api.uploadFile = async () => {};
  try {
    require('../pages/review-editor/components/review-rating-picker/review-rating-picker');
    require('../pages/review-editor/review-editor');
    for (const mode of ['review', 'edit', 'complaint']) {
      const booking = { id: 'booking-1', bookingId: 'booking-1', rating: 5, comment: '原评价', tags: ['善于沟通'],
        imageUrls: ['https://example.com/thumbnail.jpg'], imageKeys: ['reviews/original.jpg'] };
      let initialize;
      const page = { ...definition, data: structuredClone(definition.data),
        setData(values) { Object.assign(this.data, values); },
        getOpenerEventChannel: () => ({ on(event, callback) { assert.equal(event, 'init'); initialize = callback; } }) };
      page.onLoad();
      initialize({ mode, booking });
      assert.equal(page.data.ready, true);
      assert.deepEqual(page.data.ratings, {}, 'legacy totals must not become invented dimension scores');
      if (mode === 'edit') {
        assert.equal(page.data.content, '原评价');
        assert.equal(page.data.images[0].retainedUrl, 'reviews/original.jpg');
        assert.deepEqual(page.data.tags.filter(tag => tag.selected).map(tag => tag.name), ['善于沟通']);
        initialize({ mode, booking: { ...booking, ratings } });
        assert.deepEqual(page.data.ratings, ratings, 'new reviews restore all scores');
        initialize({ mode, booking });
      }
      page.onContent({ detail: { value: ' 很好 ' } });
      if (mode === 'complaint') page.chooseIssueReason({ detail: { value: 'service_incomplete' } });
      if (mode !== 'complaint') {
        const count = requests.length;
        await page.submit();
        assert.equal(requests.length, count);
        assert.equal(notices.at(-1), '请为四项分别评分');
        for (const [key, value] of Object.entries(ratings)) {
          component.methods.chooseRating.call({ triggerEvent(event, detail) {
            assert.equal(event, 'change'); page.chooseRating({ detail });
          } }, { currentTarget: { dataset: { key, value: String(value) } } });
        }
      }
      if (mode !== 'complaint') page.chooseReviewTag({ currentTarget: { dataset: { name: '守时商家' } } });
      page.data.images.push({ tempPath: 'wxfile://new.jpg', fileName: 'new.jpg', contentType: 'image/jpeg', size: 300 });
      await page.submit();
      assert.equal(requests.at(-2).data.type, mode === 'complaint' ? 'complaint' : 'review');
      const request = requests.at(-1);
      assert.equal(request.url, `/bookings/booking-1/${mode === 'complaint' ? 'complaint' : 'review'}`);
      assert.equal(request.method, mode === 'edit' ? 'PATCH' : 'POST');
      assert.deepEqual(request.data, mode === 'complaint'
        ? { description: '很好', imageObjects: ['reviews/new.jpg'], reason: 'service_incomplete' }
        : { rating: 4.25, ratings, comment: '很好', tags: mode === 'edit' ? ['守时商家', '善于沟通'] : ['守时商家'], imageObjects: ['reviews/new.jpg'], ...(mode === 'edit' ? { retainedImageUrls: ['reviews/original.jpg'] } : {}) });
      const count = requests.length;
      await page.submit();
      assert.equal(requests.length, count, 'double taps must not resubmit');
      assert.equal(page.data.submitting, false);
    }
    assert.equal(backs, 3);
  } finally {
    api.request = originalRequest; api.uploadFile = originalUpload;
    delete global.getApp; delete global.Page; delete global.Component; delete global.wx;
  }
});

test('failed edit preserves input and retained images for retry', async () => {
  let definition;
  const notices = [];
  global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api' } });
  global.Page = value => { definition = value; };
  global.wx = { getStorageSync: () => ({ token: 'token', user: {} }), removeStorageSync() {}, showToast: value => notices.push(value.title) };
  const api = require('../utils/api');
  const original = api.request;
  delete require.cache[require.resolve('../pages/review-editor/review-editor')];
  require('../pages/review-editor/review-editor');
  const page = { ...definition, data: { ...structuredClone(definition.data), ready: true, mode: 'edit', bookingId: 'b1', ratings, content: '修改评价', images: [{ existing: true, tempPath: 'thumb', retainedUrl: 'original' }] }, setData(values) { Object.assign(this.data, values); } };
  api.request = async () => { throw new Error('网络不可用'); };
  try {
    await page.submit();
    assert.equal(notices.at(-1), '网络不可用');
    assert.equal(page.data.submitting, false);
    assert.equal(page.data.submitted, false);
    assert.equal(page.data.content, '修改评价');
    assert.equal(page.data.images[0].retainedUrl, 'original');
    page.removeImage({ currentTarget: { dataset: { index: 0 } } });
    assert.deepEqual(page.data.images, []);
  } finally {
    api.request = original;
    delete global.getApp; delete global.Page; delete global.wx;
  }
});
