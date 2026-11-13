const assert = require('node:assert/strict');
let definition;
let navigation;
global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api' } });
global.Page = value => { definition = value; };
global.wx = {
  getStorageSync: key => key === 'session' ? { token: 'token', user: {} } : null,
  removeStorageSync() {},
  navigateTo(options) { navigation = options; }
};
require('../pages/profile/profile');
const review = { bookingId: 'booking-1', rating: 5, comment: '很好', tags: ['善于沟通'], imageUrls: [], imageKeys: [] };
const page = { ...definition, data: { ...definition.data, reviews: [{ bookingId: review.bookingId }] }, reviewSources: [review] };
page.editReview({ currentTarget: { dataset: { index: 0 } } });
assert.equal(navigation.url, '/pages/review-editor/review-editor');
navigation.success({ eventChannel: { emit(event, data) {
  assert.equal(event, 'init'); assert.deepEqual(data, { mode: 'edit', booking: review });
} } });
navigation = null;
review.isAwaitingReview = true;
page.editReview({ currentTarget: { dataset: { index: 0 } } });
assert.equal(navigation, null, 'pending reviews must remain uneditable');
delete global.Page; delete global.wx; delete global.getApp;
