const { onShareAppMessage } = require('../../utils/share');
const api = require('../../utils/api');
const app = getApp();
const favoriteStore = require('../../utils/favorites');
const salonDetail = require('../../utils/salonDetail');
const freshness = require('../../utils/freshness');
const imageFallback = require('../../utils/imageFallback');
const { staffRoleLabel } = require('../../utils/staffRoles');
const { postCardView } = require('../../utils/postCard');
const initiallyLoggedIn = Boolean(api.session() && api.session().token);

// 收藏分类：key 同时是 data 里列表字段的名字。
const TABS = [
  { key: 'salons', label: '沙龙', unit: '家' },
  { key: 'staff', label: '理发师', unit: '人' },
  { key: 'posts', label: '套餐', unit: '件' }
];
const EMPTY_TEXT = {
  salons: '还没有收藏的沙龙',
  staff: '还没有收藏的理发师',
  posts: '还没有收藏的套餐'
};

const loaders = {
  async salons() {
    const salons = await api.request('/favorites');
    favoriteStore.invalidate();
    return Promise.all(salons.map(async (salon) => ({
      ...salon,
      image: await api.displayImageUrl(api.salonImage(salon), 480, { webp: true }),
      nameText: salon.name || '未知沙龙',
      descriptionText: salon.description || '暂无描述'
    })));
  },

  async staff() {
    const staff = await api.request('/favorites/staff');
    favoriteStore.staff.invalidate();
    return Promise.all(staff.map(async (person) => ({
      ...person,
      image: await api.displayImageUrl(person.imageUrl, 480, { webp: true }),
      nameText: person.name || '理发师',
      subText: [person.salonName, staffRoleLabel(person.roleId)].filter(Boolean).join(' · '),
      bioText: person.bio || '暂无简介'
    })));
  },

  // 收藏接口已带回关联套餐的当前信息；relatedService 为 null 表示套餐已下架。
  async posts() {
    const posts = await api.request('/favorites/posts');
    favoriteStore.posts.invalidate();
    return Promise.all(posts.map(async (post) => ({
      ...await postCardView(post, post.relatedService ? [post.relatedService] : []),
      salonImage: await api.displayImageUrl(post.salonImageUrl, 480, { webp: true }),
      salonNameText: post.salonName || '未知沙龙',
      salonDescriptionText: post.salonDescription || '暂无描述',
      salonTags: Array.isArray(post.salonTags) ? post.salonTags : []
    })));
  }
};

const stores = {
  salons: favoriteStore,
  staff: favoriteStore.staff,
  posts: favoriteStore.posts
};

Page({
  onShareAppMessage,

  data: {
    loggedIn: initiallyLoggedIn,
    loading: initiallyLoggedIn,
    tabs: TABS,
    activeTab: 'salons',
    activeUnit: TABS[0].unit,
    emptyText: EMPTY_TEXT.salons,
    salons: [],
    staff: [],
    posts: []
  },

  onShow() {
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) tabBar.show();
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
    this.loadActiveIfStale();
  },

  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh());
  },

  switchTab(e) {
    const key = e.currentTarget.dataset.key;
    const tab = TABS.find((item) => item.key === key);
    if (!tab || key === this.data.activeTab) return;
    this.setData({ activeTab: key, activeUnit: tab.unit, emptyText: EMPTY_TEXT[key] });
    this.loadActiveIfStale();
  },

  // 短时间内返回或切回分类，且期间没有增删收藏时，不重新请求整张列表。
  loadActiveIfStale() {
    this.stamps = this.stamps || {};
    if (!freshness.isFresh(this.stamps[this.data.activeTab])) this.load();
  },

  async load() {
    const key = this.data.activeTab;
    this.stamps = this.stamps || {};
    this.setData({ loading: !this.data[key].length });
    const stamp = freshness.stamp();
    try {
      const list = await loaders[key]();
      this.setData({ [key]: list });
      this.stamps[key] = stamp;
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' });
    } finally {
      if (this.data.activeTab === key) this.setData({ loading: false });
    }
  },

  // WebP 缩略图加载失败时换回 JPEG。
  onImageError(e) {
    imageFallback.retryAsJpeg(this, e);
  },

  openDetail(e) {
    const salonId = e.currentTarget.dataset.id;
    salonDetail.prefetch(salonId, this.data.salons.find((item) => item.id === salonId));
    wx.navigateTo({ url: `/pages/detail/detail?id=${salonId}` });
  },

  openStaff(e) {
    const person = this.data.staff.find((item) => item.id === e.currentTarget.dataset.id);
    if (!person) return;
    wx.navigateTo({ url: `/pages/staff/staff?id=${encodeURIComponent(person.id)}&salonId=${encodeURIComponent(person.salonId)}` });
  },

  bookStaff(e) {
    const person = this.data.staff.find((item) => item.id === e.currentTarget.dataset.id);
    if (!person || !api.requireLogin()) return;
    wx.navigateTo({ url: `/pages/booking/booking?id=${encodeURIComponent(person.salonId)}&staffId=${encodeURIComponent(person.id)}` });
  },

  // 收藏页里的条目都是已收藏的，点击收藏按钮即取消收藏，成功后直接从列表移除，不必重新请求整张列表。
  async removeFavorite(key, id) {
    if (!this.data[key].some((item) => item.id === id)) return;
    try {
      await stores[key].setFavorite(id, false);
      this.setData({ [key]: this.data[key].filter((item) => item.id !== id) });
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' });
    }
  },

  toggle(e) {
    return this.removeFavorite('salons', e.currentTarget.dataset.id);
  },

  toggleStaff(e) {
    return this.removeFavorite('staff', e.currentTarget.dataset.id);
  },

  togglePost(e) {
    return this.removeFavorite('posts', e.currentTarget.dataset.id);
  },

  openPostSalon(e) {
    const post = this.data.posts.find((item) => item.id === e.currentTarget.dataset.id);
    if (!post || !post.salonId) return;
    wx.navigateTo({ url: `/pages/detail/detail?id=${encodeURIComponent(post.salonId)}` });
  }
});
