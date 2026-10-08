const api = require('../../utils/api');

Page({
  data: {
    salonId: '',
    reviews: [],
    loading: true,
    errorMessage: ''
  },

  onLoad(query) {
    this.setData({ salonId: String(query.salonId || '') });
    return this.load();
  },

  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh());
  },

  async load() {
    if (!this.data.salonId) {
      this.setData({ loading: false, errorMessage: '店铺信息无效' });
      return;
    }
    this.setData({ loading: true, errorMessage: '' });
    try {
      const salon = await api.request(`/salons/${encodeURIComponent(this.data.salonId)}`);
      this.setData({ reviews: await Promise.all((salon.reviews || []).map((review) => this.normalizeReview(review))) });
    } catch (error) {
      this.setData({ errorMessage: error.message || '评价加载失败，请稍后重试' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async normalizeReview(review) {
    const images = review.imageUrls || review.images || [review.imageUrl || review.image].filter(Boolean);
    return {
      ...review,
      userText: review.user || review.userName || review.phone || '用户',
      avatarUrl: api.mediaUrl(review.avatarUrl),
      starIcons: starIcons(review.rating || 5),
      serviceText: review.serviceName || review.service || '染发+修复',
      staffText: review.staffName || review.staff || 'Sato',
      dateText: formatDate(review.createdAt || review.date),
      imageUrls: await Promise.all(images.map(api.displayImageUrl))
    };
  },

  previewImage(e) {
    const review = this.data.reviews[Number(e.currentTarget.dataset.reviewIndex)] || {};
    wx.previewImage({ urls: review.imageUrls || [], current: e.currentTarget.dataset.url });
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

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
