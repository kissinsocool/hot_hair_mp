const api = require('../../utils/api');
const { ratingDisplay } = require('../../utils/rating');

Page({
  data: {
    id: '',
    salonId: '',
    staff: null,
    services: [],
    loading: true
  },

  onLoad(query) {
    this.setData({ id: query.id || '', salonId: query.salonId || '' });
    this.load();
  },

  async load() {
    try {
      const data = await api.request(`/staff/${this.data.id}`);
      data.imageUrl = api.mediaUrl(data.imageUrl);
      Object.assign(data, ratingDisplay(data.rating, data.reviewCount));
      data.starIcons = data.hasRating ? starIcons(data.rating) : [];
      data.bioText = data.bio || '暂无简介';
      data.roleText = [data.role, data.experience && `${data.experience}经验`].filter(Boolean).join(' · ');
      data.reviews = await Promise.all((data.reviews || []).map(async (review) => {
        const images = review.imageUrls || review.images || [review.imageUrl || review.image].filter(Boolean);
        return {
          ...review,
          userText: review.user || review.userName || '用户',
          ratingText: review.rating || 5,
          starIcons: starIcons(review.rating || 5),
          imageUrls: await Promise.all(images.map(api.displayImageUrl))
        };
      }));
      this.setData({ staff: data, services: data.salonServices || [] });
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  book() {
    if (!api.requireLogin()) return;
    wx.navigateTo({ url: `/pages/booking/booking?id=${this.data.salonId}&staffId=${this.data.id}` });
  },

  previewReviewImage(e) {
    const review = this.data.staff.reviews[Number(e.currentTarget.dataset.reviewIndex)] || {};
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
