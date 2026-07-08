const api = require('../../utils/api');

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
      data.ratingText = data.rating || '5.0';
      data.bioText = data.bio || '暂无简介';
      data.reviews = (data.reviews || []).map((review) => ({
        ...review,
        userText: review.user || review.userName || '用户',
        ratingText: review.rating || 5
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
  }
});
