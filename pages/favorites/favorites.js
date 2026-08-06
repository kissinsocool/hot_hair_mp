const api = require('../../utils/api');
const app = getApp();
const initiallyLoggedIn = Boolean(api.session() && api.session().token);

Page({
  data: {
    loggedIn: initiallyLoggedIn,
    loading: initiallyLoggedIn,
    salons: []
  },

  onShow() {
    const session = api.session();
    const loggedIn = Boolean(session && session.token);
    this.setData({ loggedIn });
    if (!loggedIn) {
      if (app.globalData.pendingLoginReturnRoute === 'pages/favorites/favorites') {
        app.globalData.pendingLoginReturnRoute = '';
        wx.switchTab({ url: '/pages/home/home' });
      } else {
        wx.navigateTo({ url: '/pages/login/login' });
      }
      return;
    }
    this.load();
  },

  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh());
  },

  async load() {
    this.setData({ loading: !this.data.salons.length });
    try {
      const salons = await api.request('/favorites');
      this.setData({ salons: await Promise.all(salons.map(async (salon) => ({
        ...salon,
        image: await api.displayImageUrl(api.salonImage(salon)),
        nameText: salon.name || '未知沙龙',
        descriptionText: salon.description || '暂无描述',
        ratingText: salon.rating || '4.8',
        distanceText: salon.distanceKm ? `距离你 ${Number(salon.distanceKm).toFixed(1)} km` : ''
      }))) });
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  openDetail(e) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${e.currentTarget.dataset.id}` });
  },

  async toggle(e) {
    try {
      const salon = this.data.salons.find((item) => item.id === e.currentTarget.dataset.id);
      if (!salon) return;
      await api.request(`/favorites/${encodeURIComponent(salon.id)}`, { method: 'DELETE' });
      this.load();
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' });
    }
  }
});
