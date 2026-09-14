const api = require('../../utils/api');
const { promotionCategory } = require('../../utils/promotionCategories');
const PAGE_SIZE = 30;

Page({
  data: {
    category: '',
    images: [],
    page: 0,
    hasMore: false,
    loading: true,
    loadingMore: false,
    errorMessage: ''
  },

  onLoad(query) {
    const category = promotionCategory(String(query.category || ''));
    if (!category) {
      this.setData({ loading: false, errorMessage: '分类不存在' });
      return;
    }
    this.setData({ category: category.id });
    wx.setNavigationBarTitle({ title: category.label });
    return this.load();
  },

  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    this.loadMore();
  },

  async load() {
    if (!this.data.category || this.loadingRequest) return;
    this.loadingRequest = true;
    this.setData({ loading: true, errorMessage: '' });
    try {
      const result = await api.requestPage(
        `/salons/promoted-services?category=${encodeURIComponent(this.data.category)}`,
        { page: 1, limit: PAGE_SIZE }
      );
      const images = await Promise.all(result.items.map(this.normalizeImage));
      this.setData({ images, page: 1, hasMore: result.hasMore });
    } catch (error) {
      this.setData({ errorMessage: error.message || '加载失败，请稍后重试' });
    } finally {
      this.loadingRequest = false;
      this.setData({ loading: false });
    }
  },

  async loadMore() {
    if (this.loadingRequest || this.data.loadingMore || !this.data.hasMore) return;
    this.loadingRequest = true;
    const page = this.data.page + 1;
    this.setData({ loadingMore: true });
    try {
      const result = await api.requestPage(
        `/salons/promoted-services?category=${encodeURIComponent(this.data.category)}`,
        { page, limit: PAGE_SIZE }
      );
      const images = await Promise.all(result.items.map(this.normalizeImage));
      const knownIds = new Set(this.data.images.map((item) => item.id));
      this.setData({
        images: this.data.images.concat(images.filter((item) => !knownIds.has(item.id))),
        page,
        hasMore: result.hasMore
      });
    } catch (error) {
      wx.showToast({ title: error.message || '加载失败，请稍后重试', icon: 'none' });
    } finally {
      this.loadingRequest = false;
      this.setData({ loadingMore: false });
    }
  },

  async normalizeImage(item) {
    return { ...item, imageUrl: await api.displayImageUrl(item.imageUrl) };
  },

  openSalon(e) {
    const salonId = String(e.currentTarget.dataset.salonId || '');
    if (!salonId) return;
    wx.navigateTo({ url: `/pages/detail/detail?id=${encodeURIComponent(salonId)}` });
  }
});
