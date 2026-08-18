const api = require('../../utils/api');
const app = getApp();
const couponUtils = require('../../utils/coupons');
const MAX_IMAGE_BYTES = 800 * 1024;
const PAGE_SIZE = 20;
const initialSession = api.session();
const initiallyLoggedIn = Boolean(initialSession && initialSession.token);
const initialUser = initialSession && initialSession.user || {};

Page({
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
    sheetVisible: false,
    sheetReview: null,
    sheetRating: 0,
    sheetStars: buildStars(0),
    sheetContent: '',
    sheetImages: [],
    sheetSubmitting: false,
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
    this.refreshUser();
    this.loadCoupons();
    if (this.data.activeTab === 'reviews') this.loadReviews();
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
    try {
      const response = await api.request('/auth/me');
      const current = api.session();
      if (!current || !response.user) return;
      const session = { ...current, user: response.user };
      api.saveSession(session);
      this.applyUser(session.user);
    } catch (_) {}
  },

  onPullDownRefresh() {
    const refresh = this.data.activeTab === 'reviews' ? this.loadReviews() : this.loadCoupons();
    Promise.resolve(refresh).finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.activeTab === 'reviews') this.loadMoreReviews();
  },

  onHide() {
    if (!this.data.sheetVisible) this.getTabBar().show();
  },

  openSettings() {
    wx.navigateTo({ url: '/pages/account/account' });
  },

  switchSection(e) {
    const activeTab = e.currentTarget.dataset.tab;
    this.setData({ activeTab });
    if (activeTab === 'reviews' && !this.data.reviews.length) this.loadReviews();
  },

  async loadCoupons() {
    if (!this.data.loggedIn) return;
    this.setData({ loadingCoupons: true, couponsLoadFailed: false });
    try {
      const coupons = await api.request('/auth/coupons');
      this.setData({ coupons: couponUtils.sortCoupons(coupons) });
    } catch (err) {
      this.setData({ couponsLoadFailed: true });
    } finally {
      this.setData({ loadingCoupons: false });
    }
  },

  retryCoupons() {
    this.loadCoupons();
  },

  async loadReviews() {
    if (!this.data.loggedIn || this.loadingReviewPage) return;
    this.loadingReviewPage = true;
    const version = (this.reviewsVersion || 0) + 1;
    this.reviewsVersion = version;
    this.setData({ loadingReviews: true, loadingMoreReviews: false });
    try {
      const result = await api.requestPage('/auth/reviews', { page: 1, limit: PAGE_SIZE });
      if (version !== this.reviewsVersion) return;
      this.setData({
        reviews: result.items.map(normalizeReview),
        reviewPage: 1,
        hasMoreReviews: result.hasMore
      });
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
      this.setData({
        reviews: this.data.reviews.concat(result.items.map(normalizeReview)),
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
    wx.previewImage({ urls: review.imageUrls || [], current: e.currentTarget.dataset.url });
  },

  editReview(e) {
    const review = this.data.reviews[Number(e.currentTarget.dataset.index)];
    if (!review || review.isAwaitingReview) return;
    const imageKeys = review.imageKeys || [];
    this.getTabBar().hide();
    this.setData({
      sheetVisible: true,
      sheetReview: review,
      sheetRating: review.rating,
      sheetStars: buildStars(review.rating),
      sheetContent: review.comment,
      sheetImages: review.imageUrls.map((tempPath, index) => ({
        tempPath,
        retainedUrl: imageKeys[index] || tempPath,
        existing: true
      })),
      sheetSubmitting: false
    });
  },

  closeSheet() {
    if (this.data.sheetSubmitting) return;
    this.getTabBar().show();
    this.setData({ sheetVisible: false });
  },

  chooseRating(e) {
    const rating = Number(e.currentTarget.dataset.value);
    this.setData({ sheetRating: rating, sheetStars: buildStars(rating) });
  },

  onSheetContent(e) {
    this.setData({ sheetContent: e.detail.value });
  },

  pickImages() {
    const remain = 5 - this.data.sheetImages.length;
    if (remain <= 0) return;
    wx.chooseMedia({
      count: remain,
      mediaType: ['image'],
      sizeType: ['compressed'],
      success: async (res) => {
        const additions = await prepareImages(res.tempFiles || []);
        this.setData({ sheetImages: this.data.sheetImages.concat(additions).slice(0, 5) });
      }
    });
  },

  removeImage(e) {
    const index = Number(e.currentTarget.dataset.index);
    this.setData({ sheetImages: this.data.sheetImages.filter((_, itemIndex) => itemIndex !== index) });
  },

  async submitEdit() {
    const content = this.data.sheetContent.trim();
    if (!this.data.sheetRating) return wx.showToast({ title: '请先选择星级', icon: 'none' });
    if (!content) return wx.showToast({ title: '请输入具体评价', icon: 'none' });
    this.setData({ sheetSubmitting: true });
    try {
      const newImages = this.data.sheetImages.filter((image) => !image.existing);
      const imageObjects = await uploadImages(newImages);
      await api.request(`/bookings/${this.data.sheetReview.bookingId}/review`, {
        method: 'PATCH',
        data: {
          rating: this.data.sheetRating,
          comment: content,
          retainedImageUrls: this.data.sheetImages.filter((image) => image.existing).map((image) => image.retainedUrl),
          imageObjects
        }
      });
      this.getTabBar().show();
      this.setData({ sheetVisible: false });
      wx.showToast({ title: '评价修改已提交审核' });
      await this.loadReviews();
    } catch (err) {
      wx.showToast({ title: err.message || '提交失败，请稍后重试', icon: 'none' });
    } finally {
      this.setData({ sheetSubmitting: false });
    }
  },

  deleteReview(e) {
    const review = this.data.reviews[Number(e.currentTarget.dataset.index)];
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
    imageUrls: (review.imageUrls || []).map(api.mediaUrl),
    imageKeys: review.imageKeys || [],
    starIcons: buildStars(rating).map((star) => star.icon),
    metaText: [review.serviceName, review.staffName].filter(Boolean).join(' · '),
    replyText: reply && typeof reply === 'object' ? reply.content || '' : reply || '',
    isAwaitingReview: reviewStatus === 'pending' || editStatus === 'pending',
    editButtonText: editStatus === 'pending' ? '修改审核中' : reviewStatus === 'pending' ? '评价审核中' : '编辑'
  };
}

function buildStars(rating) {
  return [1, 2, 3, 4, 5].map((value) => ({
    value,
    selected: value <= rating,
    icon: value <= rating ? '/assets/icons/star_gold.png' : '/assets/icons/star_border.png'
  }));
}

function compressImage(src) {
  return new Promise((resolve) => {
    if (!wx.compressImage) return resolve(src);
    wx.compressImage({
      src,
      quality: 35,
      success: (res) => resolve(res.tempFilePath || src),
      fail: () => resolve(src)
    });
  });
}

async function prepareImages(files) {
  const fs = wx.getFileSystemManager();
  const images = [];
  for (const file of files) {
    try {
      const tempPath = await compressImage(file.tempFilePath);
      const size = fs.statSync(tempPath).size;
      if (!size || size > MAX_IMAGE_BYTES) {
        wx.showToast({ title: '图片过大，请换一张', icon: 'none' });
        continue;
      }
      const fileName = tempPath.split('/').pop() || 'image.jpg';
      images.push({ tempPath, fileName, contentType: imageContentType(fileName), size, existing: false });
    } catch (_) {}
  }
  return images;
}

function imageContentType(fileName) {
  const name = String(fileName || '').toLowerCase();
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

async function uploadImages(images) {
  if (!images.length) return [];
  const { uploads = [] } = await api.request('/uploads/moderation/sign', {
    method: 'POST',
    data: { type: 'review', files: images.map(({ fileName, contentType, size }) => ({ fileName, contentType, size })) }
  });
  if (uploads.length !== images.length) throw new Error('图片上传凭证数量不正确');
  await Promise.all(uploads.map((upload, index) => api.uploadFile(upload.uploadUrl, images[index].tempPath, upload.fields)));
  return uploads.map((upload) => upload.objectName);
}
