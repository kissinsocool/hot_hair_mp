const { onShareAppMessage } = require('../../utils/share');
const api = require('../../utils/api');
const app = getApp();
const couponUtils = require('../../utils/coupons');
const freshness = require('../../utils/freshness');
const couponStore = require('../../utils/couponStore');
const { appendPatch } = require('../../utils/dataPatch');
const { pickFields } = require('../../utils/orders');
const PAGE_SIZE = 20;
// 「我的评价」卡片模板使用的字段；完整评价（标签、图片原始 key 等）留在逻辑层，编辑时传给评价编辑页。
const REVIEW_CARD_FIELDS = [
  'bookingId', 'salonName', 'date', 'serviceName', 'staffName', 'rating', 'ratings',
  'comment', 'imageUrls', 'replyText', 'isAwaitingReview', 'editButtonText'
];
const initialSession = api.session();
const initiallyLoggedIn = Boolean(initialSession && initialSession.token);
const initialUser = initialSession && initialSession.user || {};

Page({
  onShareAppMessage,

  data: {
    loggedIn: initiallyLoggedIn,
    displayName: initialUser.displayName || initialUser.account || '未设置昵称',
    avatarPreview: api.userAvatarUrl(initialUser),
    avatarReviewStatus: initialUser.avatarReviewStatus || 'none',
    activeTab: 'coupons',
    coupons: [],
    loadingCoupons: initiallyLoggedIn,
    couponsLoadFailed: false,
    reviews: [],
    loadingReviews: initiallyLoggedIn,
    reviewPage: 0,
    hasMoreReviews: false,
    loadingMoreReviews: false,
    deletingReviewId: ''
  },

  onShow() {
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) tabBar.show();
    this.sync();
  },

  sync() {
    const session = api.session();
    if (!session || !session.token) {
      this.setData({ loggedIn: false });
      if (app.globalData.pendingLoginReturnRoute === 'pages/profile/profile') {
        app.globalData.pendingLoginReturnRoute = '';
        wx.switchTab({ url: '/pages/home/home' });
      } else {
        wx.navigateTo({ url: '/pages/login/login' });
      }
      return;
    }
    const user = session.user || {};
    this.applyUser(user);
    // 短时间内返回且期间没有本端写操作和预约推送时，沿用已加载的数据。
    if (!freshness.isFresh(this.userStamp)) this.refreshUser();
    if (!freshness.isFresh(this.couponsStamp)) this.loadCoupons();
    if (this.data.activeTab === 'reviews' && !freshness.isFresh(this.reviewsStamp)) this.loadReviews();
  },

  applyUser(user) {
    this.setData({
      loggedIn: true,
      displayName: user.displayName || user.account || '未设置昵称',
      avatarPreview: api.userAvatarUrl(user),
      avatarReviewStatus: user.avatarReviewStatus || 'none'
    });
  },

  async refreshUser() {
    const stamp = freshness.stamp();
    try {
      const response = await api.request('/auth/me');
      const current = api.session();
      if (!current || !response.user) return;
      this.userStamp = stamp;
      // 资料没有变化时不重复写入本地存储和刷新视图。
      if (JSON.stringify(current.user) === JSON.stringify(response.user)) return;
      const session = { ...current, user: response.user };
      api.saveSession(session);
      this.applyUser(session.user);
    } catch (_) {}
  },

  onPullDownRefresh() {
    const refresh = this.data.activeTab === 'reviews' ? this.loadReviews() : this.loadCoupons({ force: true });
    Promise.resolve(refresh).finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.activeTab === 'reviews') this.loadMoreReviews();
  },

  openSettings() {
    wx.navigateTo({ url: '/pages/account/account' });
  },

  switchSection(e) {
    const activeTab = e.currentTarget.dataset.tab;
    this.setData({ activeTab });
    if (activeTab === 'reviews' && !this.data.reviews.length) this.loadReviews();
  },

  async loadCoupons({ force = false } = {}) {
    if (!this.data.loggedIn) return;
    this.setData({ loadingCoupons: true, couponsLoadFailed: false });
    const stamp = freshness.stamp();
    try {
      const coupons = await couponStore.load({ force });
      this.setData({ coupons: couponUtils.sortCoupons(coupons) });
      this.couponsStamp = stamp;
    } catch (err) {
      this.setData({ couponsLoadFailed: true });
    } finally {
      this.setData({ loadingCoupons: false });
    }
  },

  retryCoupons() {
    this.loadCoupons({ force: true });
  },

  async loadReviews() {
    if (!this.data.loggedIn || this.loadingReviewPage) return;
    this.loadingReviewPage = true;
    const version = (this.reviewsVersion || 0) + 1;
    this.reviewsVersion = version;
    this.setData({ loadingReviews: true, loadingMoreReviews: false });
    const stamp = freshness.stamp();
    try {
      const result = await api.requestPage('/auth/reviews', { page: 1, limit: PAGE_SIZE });
      if (version !== this.reviewsVersion) return;
      this.reviewSources = result.items.map(normalizeReview);
      this.setData({
        reviews: this.reviewSources.map((review) => pickFields(review, REVIEW_CARD_FIELDS)),
        reviewPage: 1,
        hasMoreReviews: result.hasMore
      });
      this.reviewsStamp = stamp;
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' });
    } finally {
      this.loadingReviewPage = false;
      this.setData({ loadingReviews: false });
    }
  },

  async loadMoreReviews() {
    if (this.loadingReviewPage || this.data.loadingMoreReviews || !this.data.hasMoreReviews) return;
    const version = this.reviewsVersion;
    const page = this.data.reviewPage + 1;
    this.setData({ loadingMoreReviews: true });
    try {
      const result = await api.requestPage('/auth/reviews', { page, limit: PAGE_SIZE });
      if (version !== this.reviewsVersion) return;
      const reviews = result.items.map(normalizeReview);
      this.reviewSources = (this.reviewSources || []).concat(reviews);
      this.setData({
        ...appendPatch('reviews', this.data.reviews, reviews.map((review) => pickFields(review, REVIEW_CARD_FIELDS))),
        reviewPage: page,
        hasMoreReviews: result.hasMore
      });
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' });
    } finally {
      if (version === this.reviewsVersion) this.setData({ loadingMoreReviews: false });
    }
  },

  previewReviewImage(e) {
    const review = this.data.reviews[Number(e.currentTarget.dataset.reviewIndex)] || {};
    api.previewImage({ urls: review.imageUrls || [], current: e.currentTarget.dataset.url });
  },

  editReview(e) {
    const review = (this.reviewSources || [])[Number(e.currentTarget.dataset.index)];
    if (!review || review.isAwaitingReview) return;
    wx.navigateTo({
      url: '/pages/review-editor/review-editor',
      success: ({ eventChannel }) => eventChannel.emit('init', { mode: 'edit', booking: review })
    });
  },

  deleteReview(e) {
    const review = (this.reviewSources || [])[Number(e.currentTarget.dataset.index)];
    if (!review || this.data.deletingReviewId) return;
    wx.showModal({
      title: '删除评价',
      content: '删除后无法恢复，确定要删除这条评价吗？',
      cancelText: '取消',
      confirmText: '确认删除',
      confirmColor: '#ff5252',
      success: async (result) => {
        if (!result.confirm) return;
        this.setData({ deletingReviewId: review.bookingId });
        try {
          await api.request(`/bookings/${review.bookingId}/review`, { method: 'DELETE' });
          wx.showToast({ title: '评价已删除' });
          await this.loadReviews();
        } catch (err) {
          wx.showToast({ title: err.message || '删除失败，请稍后重试', icon: 'none' });
        } finally {
          this.setData({ deletingReviewId: '' });
        }
      }
    });
  }
});

function normalizeReview(review) {
  const rating = Number(review.rating || 0);
  const reviewStatus = review.reviewStatus || '';
  const editStatus = review.editStatus || '';
  const reply = review.merchantReply;
  return {
    ...review,
    rating,
    imageUrls: (review.imageUrls || []).map((image) => api.thumbnailUrl(image, 360)),
    imageKeys: review.imageKeys || [],
    replyText: reply && typeof reply === 'object' ? reply.content || '' : reply || '',
    isAwaitingReview: reviewStatus === 'pending' || editStatus === 'pending',
    editButtonText: editStatus === 'pending' ? '修改审核中' : reviewStatus === 'pending' ? '评价审核中' : '编辑'
  };
}
