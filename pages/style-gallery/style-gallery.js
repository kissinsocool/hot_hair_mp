const api = require('../../utils/api');
const { promotionCategory } = require('../../utils/promotionCategories');
const PAGE_SIZE = 30;

Page({
  data: {
    category: '',
    sort: 'latest',
    latitude: null,
    longitude: null,
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
    const latitude = query.latitude === undefined ? null : Number(query.latitude);
    const longitude = query.longitude === undefined ? null : Number(query.longitude);
    this.setData({
      category: category.id,
      latitude: Number.isFinite(latitude) ? latitude : null,
      longitude: Number.isFinite(longitude) ? longitude : null
    });
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
    if (!this.data.category) return;
    const version = (this.listVersion || 0) + 1;
    this.listVersion = version;
    this.loadingRequest = true;
    this.setData({ loading: true, loadingMore: false, errorMessage: '' });
    try {
      const result = await api.requestPage(
        this.galleryPath(),
        { page: 1, limit: PAGE_SIZE }
      );
      const images = await Promise.all(result.items.map(this.normalizeImage));
      if (version !== this.listVersion) return;
      this.setData({ images, page: 1, hasMore: result.hasMore });
    } catch (error) {
      if (version !== this.listVersion) return;
      this.setData({ errorMessage: error.message || '加载失败，请稍后重试' });
    } finally {
      if (version === this.listVersion) {
        this.loadingRequest = false;
        this.setData({ loading: false });
      }
    }
  },

  galleryPath() {
    const path = `/salons/promoted-services?category=${encodeURIComponent(this.data.category)}&sort=${this.data.sort}`;
    if (this.data.sort !== 'distance') return path;
    return `${path}&latitude=${this.data.latitude}&longitude=${this.data.longitude}`;
  },

  changeSort(e) {
    const sort = e.currentTarget.dataset.sort;
    if (!['latest', 'distance'].includes(sort) || sort === this.data.sort) return;
    if (sort === 'distance' && (!Number.isFinite(this.data.latitude) || !Number.isFinite(this.data.longitude))) {
      wx.getFuzzyLocation({
        type: 'gcj02',
        success: ({ latitude, longitude }) => {
          this.setData({ sort, latitude, longitude });
          this.load();
        },
        fail: () => wx.showToast({ title: '获取位置后才能按距离排序', icon: 'none' })
      });
      return;
    }
    this.setData({ sort });
    return this.load();
  },

  async loadMore() {
    if (this.loadingRequest || this.data.loadingMore || !this.data.hasMore) return;
    const version = this.listVersion;
    this.loadingRequest = true;
    const page = this.data.page + 1;
    this.setData({ loadingMore: true });
    try {
      const result = await api.requestPage(
        this.galleryPath(),
        { page, limit: PAGE_SIZE }
      );
      const images = await Promise.all(result.items.map(this.normalizeImage));
      if (version !== this.listVersion) return;
      const knownIds = new Set(this.data.images.map((item) => item.id));
      this.setData({
        images: this.data.images.concat(images.filter((item) => !knownIds.has(item.id))),
        page,
        hasMore: result.hasMore
      });
    } catch (error) {
      if (version !== this.listVersion) return;
      wx.showToast({ title: error.message || '加载失败，请稍后重试', icon: 'none' });
    } finally {
      if (version === this.listVersion) {
        this.loadingRequest = false;
        this.setData({ loadingMore: false });
      }
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
