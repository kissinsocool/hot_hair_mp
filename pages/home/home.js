const api = require('../../utils/api');
const bookingSocket = require('../../utils/bookingSocket');
const layout = require('../../utils/layout');
const messages = require('../../utils/messages');

Page({
  data: {
    salons: [],
    filteredSalons: [],
    visibleSalons: [],
    favorites: [],
    suggestions: [],
    loading: true,
    refreshing: false,
    errorMessage: '',
    locating: false,
    latitude: 31.2304,
    longitude: 121.4737,
    locationText: '选择定位',
    keyword: '',
    visibleCount: 10,
    listTitle: '附近的店铺',
    statusBarHeight: 0,
    navBarHeight: 44,
    appBarHeight: 148,
    locatedOnce: false,
    hasUnreadMessages: false
  },

  onLoad() {
    this.setNavSize();
    this.locate();
  },

  setNavSize() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const searchHeight = 103 * ((info.windowWidth || 375) / 750);
    this.setData(layout.appBarSize(searchHeight));
  },

  onShow() {
    this.loadFavorites(false);
    this.loadUnreadMessages();
    this.unsubscribeBookingSocket = bookingSocket.subscribe((event) => {
      if (event.event === 'booking.created' || event.event === 'booking.updated') {
        this.loadUnreadMessages();
      }
    });
  },

  onHide() {
    if (this.unsubscribeBookingSocket) this.unsubscribeBookingSocket();
    this.unsubscribeBookingSocket = null;
  },

  onUnload() {
    if (this.unsubscribeBookingSocket) this.unsubscribeBookingSocket();
    this.unsubscribeBookingSocket = null;
  },

  onPullDownRefresh() {
    this.loadSalons().finally(() => wx.stopPullDownRefresh());
  },

  refresh() {
    this.setData({ refreshing: true });
    this.loadSalons().finally(() => this.setData({ refreshing: false }));
  },

  async locate() {
    if (this.data.locating) return;
    this.setData({ locating: true });
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({
          latitude: res.latitude,
          longitude: res.longitude,
          listTitle: '附近的店铺',
          locatedOnce: true
        });
        this.loadSalons();
      },
      fail: () => this.loadSalons(),
      complete: () => this.setData({ locating: false })
    });
  },

  async loadSalons() {
    this.setData({ loading: !this.data.visibleSalons.length, errorMessage: '' });
    try {
      const { latitude, longitude } = this.data;
      const salons = await api.request(`/salons?latitude=${latitude}&longitude=${longitude}`);
      const normalizedSalons = await Promise.all(salons.map((salon) => this.normalizeSalon(salon)));
      this.setData({ salons: normalizedSalons, visibleCount: 10 });
      this.applyFilter();
      this.loadFavorites(false);
    } catch (err) {
      this.setData({ errorMessage: err.message || '网络请求失败' });
      wx.showToast({ title: err.message, icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async normalizeSalon(salon) {
    return {
      ...salon,
      image: await api.displayImageUrl(salon.image),
      nameText: salon.name || '未知沙龙',
      addressText: salon.address || '',
      descriptionText: salon.description || '暂无描述',
      ratingText: salon.rating || '4.8',
      distanceText: this.formatDistance(salon.distanceKm)
    };
  },

  formatDistance(distanceKm) {
    const distance = Number(distanceKm);
    if (!distance) return '';
    return distance < 1 ? `距离你 ${Math.round(distance * 1000)} m` : `距离你 ${distance.toFixed(1)} km`;
  },

  async loadFavorites(showError = true) {
    const session = api.session();
    if (!(session && session.token)) return;
    try {
      const favorites = await api.request('/favorites');
      this.setData({ favorites: favorites.map((salon) => salon.id) });
      this.applyFilter();
    } catch (err) {
      if (showError) wx.showToast({ title: err.message, icon: 'none' });
    }
  },

  async loadUnreadMessages() {
    const session = api.session();
    if (!(session && session.token)) {
      this.setData({ hasUnreadMessages: false });
      return;
    }
    try {
      const orders = await api.request('/bookings');
      const readKey = wx.getStorageSync(messages.READ_KEY) || '';
      this.setData({ hasUnreadMessages: messages.hasUnreadBookingMessages(orders, readKey) });
    } catch (_) {
      this.setData({ hasUnreadMessages: false });
    }
  },

  onKeyword(e) {
    const keyword = e.detail.value;
    this.setData({ keyword });
    if (!keyword.trim()) {
      this.setData({ suggestions: [] });
      this.applyFilter();
      return;
    }
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.loadSuggestions(keyword), 250);
  },

  async loadSuggestions(keyword) {
    try {
      const { latitude, longitude } = this.data;
      const suggestions = await api.request(`/salons/suggestions?keyword=${encodeURIComponent(keyword)}&latitude=${latitude}&longitude=${longitude}`);
      const normalizedSuggestions = await Promise.all(suggestions.slice(0, 5).map((salon) => this.normalizeSalon(salon)));
      this.setData({ suggestions: normalizedSuggestions });
    } catch (_) {
      this.setData({ suggestions: [] });
    }
  },

  chooseSuggestion(e) {
    this.setData({ keyword: e.currentTarget.dataset.name, suggestions: [] });
    this.submitSearch();
  },

  submitSearch() {
    this.setData({ visibleCount: 10, suggestions: [] });
    this.applyFilter();
  },

  applyFilter() {
    const keyword = this.data.keyword.trim().toLowerCase();
    const favoriteSet = new Set(this.data.favorites);
    const filteredSalons = this.data.salons
      .filter((salon) => !keyword || String(salon.name || '').toLowerCase().includes(keyword))
      .map((salon) => {
        const isFavorite = favoriteSet.has(salon.id);
        return { ...salon, isFavorite };
      });
    this.setData({
      filteredSalons,
      visibleSalons: filteredSalons.slice(0, this.data.visibleCount)
    });
  },

  loadMore() {
    this.setData({ visibleCount: this.data.visibleCount + 10 });
    this.applyFilter();
  },

  async toggleFavorite(e) {
    if (!api.requireLogin()) return;
    try {
      const salon = this.data.salons.find((item) => item.id === e.currentTarget.dataset.id);
      if (!salon) return;
      await api.request('/favorites/toggle', { method: 'POST', data: salon });
      await this.loadFavorites();
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' });
    }
  },

  openDetail(e) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${e.currentTarget.dataset.id}` });
  },

  openMessages() {
    if (!api.requireLogin()) return;
    wx.navigateTo({ url: '/pages/messages/messages' });
  },

  openLocation() {
    wx.navigateTo({
      url: `/pages/location/location?text=${encodeURIComponent(this.data.locationText)}&latitude=${this.data.latitude}&longitude=${this.data.longitude}`
    });
  }
});
