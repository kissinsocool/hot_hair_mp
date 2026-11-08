const { onShareAppMessage } = require('../../utils/share');
const api = require('../../utils/api');
const { ratingDisplay } = require('../../utils/rating');
const { staffRoleLabel } = require('../../utils/staffRoles');
const REVIEW_PAGE_SIZE = 10;

Page({
  onShareAppMessage,

  data: {
    id: '',
    salonId: '',
    salonName: '',
    staff: null,
    services: [],
    loading: true,
    reviews: [],
    reviewPage: 0,
    hasMoreReviews: false,
    loadingReviews: false,
    reviewsError: ''
  },

  onLoad(query) {
    this.setData({ id: query.id || '', salonId: query.salonId || '' });
    return Promise.all([this.load(), this.loadReviews(true)]);
  },

  onReachBottom() {
    return this.loadMoreReviews();
  },

  onUnload() {
    this.reviewsVersion = (this.reviewsVersion || 0) + 1;
  },

  async load() {
    try {
      const data = await api.request(`/staff/${this.data.id}`);
      data.imageUrl = api.thumbnailUrl(data.imageUrl, 720);
      Object.assign(data, ratingDisplay(data.rating, data.reviewCount));
      data.starIcons = data.hasRating ? starIcons(data.rating) : [];
      data.bioText = data.bio || '暂无简介';
      data.roleText = [staffRoleLabel(data.roleId), data.experience && `${data.experience}经验`].filter(Boolean).join(' · ');
      this.setData({ staff: data, salonName: data.salonName || '', services: data.salonServices || [] });
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  loadMoreReviews() {
    if (this.data.loadingReviews || !this.data.hasMoreReviews) return;
    return this.loadReviews(false);
  },

  retryReviews() {
    return this.loadReviews(this.data.reviewPage === 0);
  },

  async loadReviews(reset) {
    if (!this.data.id) return;
    if (reset) this.reviewsVersion = (this.reviewsVersion || 0) + 1;
    const version = this.reviewsVersion;
    const page = reset ? 1 : this.data.reviewPage + 1;
    this.setData(reset
      ? { reviews: [], reviewPage: 0, hasMoreReviews: false, loadingReviews: true, reviewsError: '' }
      : { loadingReviews: true, reviewsError: '' });
    try {
      const result = await api.request(`/staff/${encodeURIComponent(this.data.id)}/reviews?page=${page}&limit=${REVIEW_PAGE_SIZE}`);
      if (version !== this.reviewsVersion) return;
      const reviews = await Promise.all((result.items || []).map(normalizeReview));
      if (version !== this.reviewsVersion) return;
      const existing = reset ? [] : this.data.reviews;
      const knownIds = new Set(existing.map(review => review.id));
      this.setData({
        reviews: existing.concat(reviews.filter(review => !knownIds.has(review.id))),
        reviewPage: page,
        hasMoreReviews: result.hasMore === true
      });
    } catch (error) {
      if (version !== this.reviewsVersion) return;
      this.setData({ reviewsError: error.message || '评价加载失败，请稍后重试' });
    } finally {
      if (version === this.reviewsVersion) this.setData({ loadingReviews: false });
    }
  },

  book() {
    if (!api.requireLogin()) return;
    wx.navigateTo({ url: `/pages/booking/booking?id=${this.data.salonId}&staffId=${this.data.id}` });
  },

  previewAvatar() {
    const current = this.data.staff.imageUrl;
    if (current) api.previewImage({ urls: [current], current });
  },

  previewReviewImage(e) {
    const review = this.data.reviews[Number(e.currentTarget.dataset.reviewIndex)] || {};
    api.previewImage({ urls: review.imageUrls || [], current: e.currentTarget.dataset.url });
  }
});

async function normalizeReview(review) {
  const images = review.imageUrls || review.images || [review.imageUrl || review.image].filter(Boolean);
  return {
    ...review,
    userText: review.user || review.userName || '用户',
    imageUrls: await Promise.all(images.map((image) => api.displayImageUrl(image, 360)))
  };
}

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
