const { onShareAppMessage } = require('../../utils/share');
const api = require('../../utils/api');
const { appendPatch } = require('../../utils/dataPatch');
const { markReviewHelpful } = require('../../utils/reviewHelpful');
const { formatReviewDate } = require('../../utils/reviewDate');
const imageFallback = require('../../utils/imageFallback');
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

  // 网络恢复后重新加载之前失败的内容。
  onNetworkRestored() {
    if (this.data.errorMessage) this.load();
    else if (this.data.loadMoreError) this.loadMore();
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
        // 重新加载时整表替换，加载更多时只追加新增的评价。
        ...(reset
          ? { reviews: reviews.filter(review => !knownIds.has(review.id)) }
          : appendPatch('reviews', existing, reviews.filter(review => !knownIds.has(review.id)))),
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
      serviceText: review.serviceName || review.service || '',
      staffText: review.staffName || review.staff || '',
      dateText: formatReviewDate(review.createdAt || review.date),
      imageUrls: await Promise.all(images.map((image) => api.displayImageUrl(image, 360, { webp: true })))
    };
  },

  // WebP 缩略图加载失败时换回 JPEG。
  onImageError(e) {
    imageFallback.retryAsJpeg(this, e);
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
