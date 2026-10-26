const { onShareAppMessage } = require('../../utils/share');
const api = require('../../utils/api');
const { markReviewHelpful } = require('../../utils/reviewHelpful');
const { formatReviewDate } = require('../../utils/reviewDate');
const PAGE_SIZE = 10;

Page({
  onShareAppMessage,

  data: {
    salonId: '',
    reviews: [],
    filter: 'latest',
    counts: null,
    reviewTags: [],
    page: 0,
    hasMore: false,
    loading: true,
    loadingMore: false,
    errorMessage: '',
    loadMoreError: ''
  },

  onLoad(query) {
    this.setData({ salonId: String(query.salonId || '') });
    return this.load();
  },

  onPullDownRefresh() {
    return this.load().finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    return this.loadMore();
  },

  onUnload() {
    this.reviewFeedbackDisposed = true;
    this.loadVersion = (this.loadVersion || 0) + 1;
  },

  load() {
    return this.loadPage(true);
  },

  loadMore() {
    if (this.data.loading || this.data.loadingMore || !this.data.hasMore) return;
    return this.loadPage(false);
  },

  async loadPage(reset) {
    if (!this.data.salonId) {
      this.setData({ loading: false, errorMessage: '店铺信息无效' });
      return;
    }
    if (reset) this.loadVersion = (this.loadVersion || 0) + 1;
    const version = this.loadVersion;
    const page = reset ? 1 : this.data.page + 1;
    const filter = this.data.filter;
    this.setData(reset
      ? { loading: true, loadingMore: false, reviews: [], page: 0, hasMore: false, errorMessage: '', loadMoreError: '' }
      : { loadingMore: true, loadMoreError: '' });
    try {
      const result = await api.request(`/salons/${encodeURIComponent(this.data.salonId)}/reviews?filter=${filter}&page=${page}&limit=${PAGE_SIZE}`);
      if (version !== this.loadVersion) return;
      const reviews = await Promise.all(result.items.map((review) => this.normalizeReview(review)));
      if (version !== this.loadVersion) return;
      const existing = reset ? [] : this.data.reviews;
      const knownIds = new Set(existing.map(review => review.id));
      this.setData({
        reviews: existing.concat(reviews.filter(review => !knownIds.has(review.id))),
        page,
        hasMore: result.hasMore,
        counts: result.counts,
        reviewTags: result.reviewTags || []
      });
    } catch (error) {
      if (version !== this.loadVersion) return;
      const message = error.message || '评价加载失败，请稍后重试';
      this.setData(reset ? { errorMessage: message } : { loadMoreError: message });
    } finally {
      if (version === this.loadVersion) this.setData({ loading: false, loadingMore: false });
    }
  },

  async normalizeReview(review) {
    const images = review.imageUrls || review.images || [review.imageUrl || review.image].filter(Boolean);
    return {
      ...review,
      helpfulCount: Number(review.helpfulCount) || 0,
      helpful: false, // 感谢提示仅表示本次页面内提交成功，不恢复历史反馈状态。
      helpfulSubmitting: false,
      userText: review.user || review.userName || review.phone || '用户',
      avatarUrl: api.thumbnailUrl(review.avatarUrl, 160),
      starIcons: starIcons(review.rating || 5),
      serviceText: review.serviceName || review.service || '染发+修复',
      staffText: review.staffName || review.staff || 'Sato',
      dateText: formatReviewDate(review.createdAt || review.date),
      imageUrls: await Promise.all(images.map((image) => api.displayImageUrl(image, 360)))
    };
  },

  markReviewHelpful(e) {
    return markReviewHelpful(this, 'reviews', e);
  },

  changeFilter(e) {
    const filter = e.currentTarget.dataset.filter;
    if (!['latest', 'negative', 'neutral', 'photos'].includes(filter) || filter === this.data.filter) return;
    this.setData({ filter });
    return this.load();
  },

  previewImage(e) {
    const review = this.data.reviews[Number(e.currentTarget.dataset.reviewIndex)] || {};
    api.previewImage({ urls: review.imageUrls || [], current: e.currentTarget.dataset.url });
  }
});

function starIcons(value) {
  const rating = Math.max(0, Math.min(5, Number(value) || 0));
  const full = Math.floor(rating);
  const hasHalf = rating > full;
  return Array.from({ length: 5 }, (_, index) => {
    if (index < full) return '/assets/icons/star_gold.png';
    if (index === full && hasHalf) return '/assets/icons/star_half_gold.png';
    return '/assets/icons/star_border_gold.png';
  });
}
