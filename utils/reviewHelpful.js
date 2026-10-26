const api = require('./api');

async function markReviewHelpful(page, listKey, event) {
  const { bookingId, reviewId } = event.currentTarget.dataset;
  const matches = review => review.bookingId === bookingId && review.id === reviewId;
  const review = page.data[listKey].find(matches);
  if (!review || review.helpful || review.helpfulSubmitting || !bookingId || !reviewId) return;
  if (!api.requireLogin()) return;
  const pending = page.reviewHelpfulRequests || (page.reviewHelpfulRequests = new Set());
  const key = JSON.stringify([bookingId, reviewId]);
  if (pending.has(key)) return;
  const update = values => {
    if (page.reviewFeedbackDisposed) return;
    page.setData({ [listKey]: page.data[listKey].map(item => matches(item) ? { ...item, ...values } : item) });
  };
  pending.add(key);
  update({ helpfulSubmitting: true });
  try {
    const result = await api.request(`/bookings/${encodeURIComponent(bookingId)}/review/helpful`, {
      method: 'POST', data: { reviewId }
    });
    update({ helpful: result.helpful });
  } catch (error) {
    if (!page.reviewFeedbackDisposed) wx.showToast({ title: error.message || '反馈失败，请稍后重试', icon: 'none' });
  } finally {
    pending.delete(key);
    update({ helpfulSubmitting: false });
  }
}

module.exports = { markReviewHelpful };
