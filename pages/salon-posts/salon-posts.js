const api = require('../../utils/api');
const PAGE_SIZE = 10;

Page({
  data: {
    salonId: '',
    posts: [],
    page: 0,
    hasMore: false,
    loading: true,
    loadingMore: false,
    errorMessage: ''
  },

  onLoad(query) {
    this.setData({ salonId: String(query.salonId || '') });
    return this.load();
  },

  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    this.loadMore();
  },

  async load() {
    if (!this.data.salonId) {
      this.setData({ loading: false, errorMessage: '店铺信息无效' });
      return;
    }
    this.setData({ loading: true, errorMessage: '' });
    try {
      const result = await api.requestPage(this.postsPath(), { page: 1, limit: PAGE_SIZE });
      this.setData({
        posts: await Promise.all(result.items.map((post) => this.normalizePost(post))),
        page: 1,
        hasMore: result.hasMore
      });
    } catch (error) {
      this.setData({ errorMessage: error.message || '动态加载失败，请稍后重试' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadMore() {
    if (this.data.loading || this.data.loadingMore || !this.data.hasMore) return;
    const page = this.data.page + 1;
    this.setData({ loadingMore: true });
    try {
      const result = await api.requestPage(this.postsPath(), { page, limit: PAGE_SIZE });
      const posts = await Promise.all(result.items.map((post) => this.normalizePost(post)));
      const knownIds = new Set(this.data.posts.map((post) => post.id));
      this.setData({
        posts: this.data.posts.concat(posts.filter((post) => !knownIds.has(post.id))),
        page,
        hasMore: result.hasMore
      });
    } catch (error) {
      wx.showToast({ title: error.message || '加载失败，请稍后重试', icon: 'none' });
    } finally {
      this.setData({ loadingMore: false });
    }
  },

  postsPath() {
    return `/salons/${encodeURIComponent(this.data.salonId)}/posts`;
  },

  async normalizePost(post) {
    return {
      ...post,
      authorImageUrl: await api.displayImageUrl(post.authorImageUrl),
      imageUrls: await Promise.all((post.imageUrls || []).map(api.displayImageUrl)),
      dateText: this.formatDate(post.createdAt)
    };
  },

  formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (number) => String(number).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  },

  previewImage(e) {
    const post = this.data.posts[Number(e.currentTarget.dataset.postIndex)] || {};
    wx.previewImage({ urls: post.imageUrls || [], current: e.currentTarget.dataset.url });
  },

  openStaff(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/staff/staff?id=${encodeURIComponent(id)}&salonId=${encodeURIComponent(this.data.salonId)}` });
  }
});
