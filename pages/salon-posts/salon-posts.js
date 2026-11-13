const { onShareAppMessage } = require('../../utils/share');
const api = require('../../utils/api');
const { appendPatch } = require('../../utils/dataPatch');
const salonDetail = require('../../utils/salonDetail');
const favoriteStore = require('../../utils/favorites');
const { postCardView } = require('../../utils/postCard');
const PAGE_SIZE = 10;

Page({
  onShareAppMessage,

  data: {
    salonId: '',
    posts: [],
    page: 0,
    hasMore: false,
    loading: true,
    loadingMore: false,
    errorMessage: '',
    favoritePostIds: {}
  },

  onLoad(query) {
    this.setData({ salonId: String(query.salonId || '') });
    return this.load();
  },

  // 每次显示都同步收藏状态（缓存期内不发请求），从收藏页取消收藏后返回也能更新。
  onShow() {
    this.loadFavoriteIds();
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
      // 关联套餐的价格和标签来自店铺详情；从详情页进入时直接命中详情缓存，不会多发请求。
      // 套餐取不到时动态照常展示，关联套餐只显示名称。
      const [result, services] = await Promise.all([
        api.requestPage(this.postsPath(), { page: 1, limit: PAGE_SIZE }),
        salonDetail.load(this.data.salonId).then((salon) => salon.services || [], () => null)
      ]);
      this.services = services;
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
        ...appendPatch('posts', this.data.posts, posts.filter((post) => !knownIds.has(post.id))),
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

  // 全部动态都属于当前店铺。
  normalizePost(post) {
    return postCardView({ ...post, salonId: this.data.salonId }, this.services);
  },

  async loadFavoriteIds() {
    const session = api.session();
    if (!(session && session.token)) {
      this.setData({ favoritePostIds: {} });
      return;
    }
    try {
      this.setData({ favoritePostIds: favoriteStore.idSet(await favoriteStore.posts.loadIds()) });
    } catch (_) {}
  },

  async onFavoriteChange(e) {
    if (!api.requireLogin()) return;
    const { id, favorite } = e.detail;
    try {
      const done = await favoriteStore.posts.toggle(id, favorite, (value) => this.setData({
        favoritePostIds: { ...this.data.favoritePostIds, [id]: value }
      }));
      if (done) wx.showToast({ title: favorite ? '已收藏' : '已取消收藏', icon: 'none' });
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' });
    }
  }
});
