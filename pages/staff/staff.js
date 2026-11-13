const { onShareAppMessage } = require('../../utils/share');
const api = require('../../utils/api');
const imageFallback = require('../../utils/imageFallback');
const { appendPatch } = require('../../utils/dataPatch');
const { ratingDisplay } = require('../../utils/rating');
const { staffRoleLabel } = require('../../utils/staffRoles');
const favoriteStore = require('../../utils/favorites');
const REVIEW_PAGE_SIZE = 10;

Page({
  onShareAppMessage,

  data: {
    id: '',
    salonId: '',
    salonName: '',
    staff: null,
    isFavorite: false,
    favoriteCount: 0,
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

  // 每次显示都同步收藏状态（缓存期内不发请求），从收藏页取消收藏后返回也能更新。
  onShow() {
    this.loadFavoriteState();
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
      this.setData({
        staff: data,
        salonName: data.salonName || '',
        services: data.salonServices || [],
        favoriteCount: Number(data.favoriteCount) || 0
      });
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
        // 重新加载时整表替换，加载更多时只追加新增的评价。
        ...(reset
          ? { reviews: reviews.filter(review => !knownIds.has(review.id)) }
          : appendPatch('reviews', existing, reviews.filter(review => !knownIds.has(review.id)))),
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

  async loadFavoriteState() {
    const session = api.session();
    if (!(session && session.token) || !this.data.id) {
      this.setData({ isFavorite: false });
      return;
    }
    try {
      const ids = await favoriteStore.staff.loadIds();
      this.setData({ isFavorite: ids.includes(this.data.id) });
    } catch (_) {}
  },

  async toggleFavorite() {
    if (!api.requireLogin() || !this.data.id) return;
    const isFavorite = !this.data.isFavorite;
    const count = Number(this.data.favoriteCount) || 0;
    try {
      // 被收藏数先按本次操作估算，成功后以服务端返回的数为准；失败回滚时恢复原值。
      const done = await favoriteStore.staff.toggle(this.data.id, isFavorite, (value) => this.setData({
        isFavorite: value,
        favoriteCount: value === isFavorite ? Math.max(0, count + (isFavorite ? 1 : -1)) : count
      }));
      if (done) this.setData({ favoriteCount: Number(done.result && done.result.favoriteCount) || 0 });
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' });
    }
  },

  // WebP 缩略图加载失败时换回 JPEG。
  onImageError(e) {
    imageFallback.retryAsJpeg(this, e);
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
    imageUrls: await Promise.all(images.map((image) => api.displayImageUrl(image, 360, { webp: true })))
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
