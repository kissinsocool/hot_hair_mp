const { onShareAppMessage } = require('../../utils/share');
const api = require('../../utils/api');
const { markReviewHelpful } = require('../../utils/reviewHelpful');
const { formatReviewDate } = require('../../utils/reviewDate');
const ad = require('../../utils/ad');
const analytics = require('../../utils/analytics');
const favoriteStore = require('../../utils/favorites');
const salonDetail = require('../../utils/salonDetail');
const { ratingDisplay } = require('../../utils/rating');
const { serviceTagLabels } = require('../../utils/serviceTags');
const { staffRoleLabel } = require('../../utils/staffRoles');
const { afterSalesPolicyLabels } = require('../../utils/afterSalesPolicies');
const { postServiceView } = require('../../utils/postService');
const navigation = require('../../utils/navigation');
const imageFallback = require('../../utils/imageFallback');
// 「相关店铺」距离可视区域还有这么远时开始请求，滚动到时内容已经就绪。
const RELATED_SALONS_PRELOAD_PX = 600;

Page({
  onShareAppMessage,

  data: {
    id: '',
    salon: null,
    isFavorite: false,
    favoritePostIds: {},
    currentPromoIndex: 0,
    reviewCount: 3,
    visibleReviews: [],
    relatedSalons: [],
    loading: true,
    errorMessage: '',
    ad: ad.DEFAULT
  },

  onLoad(query) {
    const id = query.id || '';
    // 从列表进入时，先用列表里已有的店铺信息展示头部，不必整页等待详情接口。
    const summary = salonDetail.summary(id);
    this.setData(summary ? { id, salon: this.buildSalonPreview(summary) } : { id });
    ad.load().then((config) => this.setData({ ad: config }));
    this.load();
  },

  onUnload() {
    this.reviewFeedbackDisposed = true;
    this.stopRelatedSalonsObserver();
  },

  markReviewHelpful(e) {
    return markReviewHelpful(this, 'visibleReviews', e);
  },

  async load() {
    if (this.loadingSalon) return;
    this.loadingSalon = true;
    this.setData({ loading: true, errorMessage: '' });
    let relatedSource = null;
    try {
      // 详情页始终读取最新数据，并刷新供预约页复用的缓存。
      const source = await salonDetail.load(this.data.id, { maxAgeMs: 0 });
      const salon = await this.buildSalonView(source);
      // 仅供交互方法使用的原始数据不进入 setData，避免增加视图层传输体积。
      this.salonSource = {
        name: source.name || '',
        phone: source.phone || '',
        address: source.address || '',
        location: source.location,
        geoLocation: source.geoLocation,
        serviceImageUrls: Object.fromEntries((source.services || []).map((service) => [service.id, serviceImageUrls(service)]))
      };
      // 详情页只展示前几条评价，完整列表在“查看全部”页面分页加载。
      const visibleReviews = await Promise.all((source.reviews || [])
        .slice(0, this.data.reviewCount)
        .map((review) => this.normalizeReview(review)));
      this.setData({ salon, visibleReviews });
      this.loadFavoriteState();
      relatedSource = source;
    } catch (err) {
      this.setData({ errorMessage: err.message || '店铺加载失败，请稍后重试' });
    } finally {
      this.loadingSalon = false;
      // 详情正文（含「相关店铺」的位置）在 loading 结束后才渲染，渲染完成后才能开始观察。
      this.setData({ loading: false }, () => {
        if (relatedSource) this.observeRelatedSalons(relatedSource);
      });
    }
  },

  // 「相关店铺」在详情靠后的位置：滚动接近时才请求附近店铺列表，
  // 只看了头部和套餐就离开或去预约的用户不必多拉一次列表。
  observeRelatedSalons(source) {
    this.stopRelatedSalonsObserver();
    if (this.reviewFeedbackDisposed || !salonCoordinates(source)) return;
    const observer = this.createIntersectionObserver();
    this.relatedSalonsObserver = observer;
    observer
      .relativeToViewport({ bottom: RELATED_SALONS_PRELOAD_PX })
      .observe('.related-salons-anchor', (entry) => {
        if (this.relatedSalonsObserver !== observer || !(entry.intersectionRatio > 0)) return;
        this.stopRelatedSalonsObserver();
        this.loadRelatedSalons(source);
      });
  },

  stopRelatedSalonsObserver() {
    const observer = this.relatedSalonsObserver;
    this.relatedSalonsObserver = null;
    if (observer) observer.disconnect();
  },

  // 详情返回前的头部预览，只包含列表数据里已有的字段。
  buildSalonPreview(source) {
    const preview = {
      name: source.name,
      description: source.description,
      isFeatured: source.isFeatured,
      businessDistrict: typeof source.businessDistrict === 'string' ? source.businessDistrict.trim() : '',
      image: api.thumbnailUrl(api.salonImage(source), 960)
    };
    if (source.reviewCount === undefined || source.reviewCount === null) return preview;
    const rating = ratingDisplay(source.rating, source.reviewCount);
    return {
      ...preview,
      ...rating,
      starIcons: starIcons(rating.hasRating ? rating.ratingText : 5),
      reviewTotalText: source.reviewCount
    };
  },

  // 只保留模板使用的字段。
  async buildSalonView(source) {
    const image = await api.displayImageUrl(api.salonImage(source), 960);
    const promoImages = await Promise.all((source.promoImages || source.images || []).map((item) => api.displayImageUrl(item, 960, { webp: true })));
    const rating = ratingDisplay(source.rating, source.reviewCount);
    const services = await Promise.all((source.services || []).map((service) => this.normalizeService(service)));
    return {
      name: source.name,
      description: source.description,
      isFeatured: source.isFeatured,
      businessDistrict: typeof source.businessDistrict === 'string' ? source.businessDistrict.trim() : '',
      image,
      promoImages: promoImages.length || !image ? promoImages : [image],
      descriptionText: source.fullDescription || source.description || '暂无详细描述',
      openingHoursText: source.openingHours || '暂无营业时间',
      weeklyClosedDaysText: this.formatWeeklyClosedDays(source.weeklyClosedDays),
      afterSalesPolicies: afterSalesPolicyLabels(source.afterSalesPolicyIds),
      acceptsSameDayBooking: source.acceptsSameDayBooking,
      phoneText: source.phone || '暂无电话',
      addressText: this.formatAddress(source.address),
      ...rating,
      starIcons: starIcons(rating.hasRating ? rating.ratingText : 5),
      reviewCount: source.reviewCount,
      reviewTotalText: source.reviewCount,
      reviewTags: (source.reviewTags || [])
        .filter((tag) => tag.name && Number(tag.count) > 0)
        .map((tag) => ({ name: tag.name, count: tag.count })),
      services,
      staff: await Promise.all((source.staff || []).map(async (staff) => ({
        id: staff.id,
        name: staff.name,
        imageUrl: await api.displayImageUrl(staff.imageUrl, 240),
        roleText: staffRoleLabel(staff.roleId),
        experienceText: staff.experience || '',
        bioText: staff.bio || staff.description || '暂无简介'
      }))),
      latestPosts: await Promise.all((source.latestPosts || []).map((post) => this.normalizePost(post, source.services || []))),
      hasMorePosts: source.hasMorePosts === true
    };
  },

  async normalizeService(service) {
    const imageUrls = serviceImageUrls(service);
    return {
      id: service.id,
      name: service.name,
      imageUrl: await api.displayImageUrl(imageUrls[0] || '', 480, { webp: true }),
      hasGallery: imageUrls.length > 1,
      tags: serviceTagLabels(service.tagIds),
      noteText: service.note || service.description || '',
      durationText: this.formatDuration(service.durationMinutes),
      priceFen: service.priceFen,
      discountTenths: service.discountTenths,
      originalPriceFen: service.originalPriceFen
    };
  },

  // WebP 缩略图加载失败时换回 JPEG。
  onImageError(e) {
    imageFallback.retryAsJpeg(this, e);
  },

  // 网络恢复后重新加载之前失败的内容。
  onNetworkRestored() {
    if (this.data.errorMessage) this.load();
  },

  retryLoad() {
    return this.load();
  },

  async loadRelatedSalons(salon) {
    const coordinates = salonCoordinates(salon);
    if (!coordinates) return;
    try {
      const { latitude, longitude } = coordinates;
      const result = await api.requestPage(`/salons?latitude=${latitude}&longitude=${longitude}`, { page: 1, limit: 10 });
      const sources = result.items.filter((item) => item.id !== this.data.id).slice(0, 9);
      // 列表摘要留在逻辑层，打开相关店铺时交给详情页先展示头部。
      this.relatedSalonSources = Object.fromEntries(sources.map((item) => [item.id, item]));
      const relatedSalons = await Promise.all(sources
        .map(async (item) => ({
          id: item.id,
          name: item.name,
          description: item.description || '',
          image: await api.displayImageUrl(api.salonImage(item), 480, { webp: true }),
          detailUrl: `/pages/detail/detail?id=${encodeURIComponent(item.id)}`
        })));
      if (!this.reviewFeedbackDisposed) this.setData({ relatedSalons });
    } catch (_) {
      // 附近店铺加载失败不影响当前店铺详情和评价。
    }
  },

  async normalizeReview(review) {
    const images = review.imageUrls || review.images || [review.imageUrl || review.image].filter(Boolean);
    return {
      id: review.id,
      bookingId: review.bookingId,
      rating: review.rating,
      ratings: review.ratings,
      comment: review.comment,
      helpfulCount: Number(review.helpfulCount) || 0,
      helpful: false, // 感谢提示仅表示本次页面内提交成功，不恢复历史反馈状态。
      helpfulSubmitting: false,
      userText: review.user || review.userName || review.phone || '用户',
      avatarUrl: api.thumbnailUrl(review.avatarUrl, 160),
      serviceText: review.serviceName || review.service || '',
      staffText: review.staffName || review.staff || '',
      dateText: formatReviewDate(review.createdAt || review.date),
      imageUrls: await Promise.all(images.map((image) => api.displayImageUrl(image, 360, { webp: true })))
    };
  },

  async normalizePost(post, services) {
    return {
      id: post.id,
      salonId: this.data.id,
      content: post.content,
      authorName: post.authorName,
      authorStaffId: post.authorStaffId,
      ...postServiceView(post, services),
      imageUrls: await Promise.all((post.imageUrls || []).map((image) => api.displayImageUrl(image, 480, { webp: true }))),
      dateText: this.formatDate(post.createdAt)
    };
  },

  formatDuration(value) {
    if (!value) return '';
    return /^\d+$/.test(String(value)) ? `${value}分钟` : String(value).replace(/\s*min$/i, '分钟');
  },

  formatAddress(value) {
    if (!value) return '地址未知';
    const address = String(value).trim();
    const match = address.match(/^(?:(?:北京|天津|上海|重庆)市|.+?(?:省|自治区|特别行政区))?(?:.+?(?:市|自治州|地区|盟))?.*?[\u3400-\u9fff](?:区(?![)）])|县|旗|市)(.+)$/);
    return match && match[1].trim() || address;
  },

  formatWeeklyClosedDays(days) {
    const names = ['', '一', '二', '三', '四', '五', '六', '日'];
    const normalized = [...new Set(Array.isArray(days) ? days : [])]
      .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7)
      .sort();
    return normalized.length ? `每周${normalized.map((day) => names[day]).join('、')}休息` : '';
  },

  formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  },

  async loadFavoriteState() {
    const session = api.session();
    if (!(session && session.token)) return;
    const hasPosts = Boolean(this.data.salon && this.data.salon.latestPosts && this.data.salon.latestPosts.length);
    const [salonIds, postIds] = await Promise.all([
      favoriteStore.loadIds().catch(() => null),
      hasPosts ? favoriteStore.posts.loadIds().catch(() => null) : null
    ]);
    const updates = {};
    if (salonIds) updates.isFavorite = salonIds.includes(this.data.id);
    if (postIds) updates.favoritePostIds = favoriteStore.idSet(postIds);
    if (Object.keys(updates).length) this.setData(updates);
  },

  async toggleFavorite() {
    if (!api.requireLogin()) return;
    try {
      await favoriteStore.toggle(this.data.id, !this.data.isFavorite, (isFavorite) => this.setData({ isFavorite }));
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' });
    }
  },

  async togglePostFavorite(e) {
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
  },

  callPhone() {
    const phone = this.salonSource && this.salonSource.phone;
    if (!phone) return;
    wx.makePhoneCall({ phoneNumber: phone });
  },

  openMap() {
    const salon = this.salonSource || {};
    const coordinates = salonCoordinates(salon);
    if (!coordinates) {
      wx.showToast({ title: '商家暂未配置导航位置', icon: 'none' });
      return;
    }
    wx.openLocation({
      ...coordinates,
      name: salon.name || '预约门店',
      address: salon.address,
      scale: 16,
      fail: () => wx.showToast({ title: '地图打开失败', icon: 'none' })
    });
  },

  previewImage(e) {
    api.previewImage({ urls: this.data.salon.promoImages, current: e.currentTarget.dataset.url });
  },

  onPromoChange(e) {
    this.setData({ currentPromoIndex: e.detail.current || 0 });
  },

  previewReviewImage(e) {
    const review = this.data.visibleReviews[Number(e.currentTarget.dataset.reviewIndex)] || {};
    api.previewImage({ urls: review.imageUrls || [], current: e.currentTarget.dataset.url });
  },

  // 详情页之间可以连续跳转，栈满时由 navigation 改为替换当前页。
  openRelatedSalon(e) {
    const salon = this.data.relatedSalons.find((item) => item.id === e.currentTarget.dataset.id);
    if (!salon) return;
    salonDetail.prefetch(salon.id, this.relatedSalonSources && this.relatedSalonSources[salon.id]);
    navigation.navigateTo(salon.detailUrl);
  },

  showAllPosts() {
    wx.navigateTo({ url: `/pages/salon-posts/salon-posts?salonId=${encodeURIComponent(this.data.id)}` });
  },

  showAllReviews() {
    wx.navigateTo({ url: `/pages/salon-reviews/salon-reviews?salonId=${encodeURIComponent(this.data.id)}` });
  },

  async openService(e) {
    const serviceId = e.currentTarget.dataset.id;
    analytics.track('service_click', { salonId: this.data.id, serviceId });
    const service = this.data.salon.services.find((item) => item.id === serviceId);
    if (!service || !service.imageUrl) return;
    const imageUrls = (this.salonSource && this.salonSource.serviceImageUrls[serviceId]) || [];
    const remainingImages = await Promise.all(imageUrls.slice(1).map((image) => api.displayImageUrl(image)));
    api.previewImage({ urls: [service.imageUrl, ...remainingImages], current: service.imageUrl });
  },

  bookService(e) {
    const serviceId = e.currentTarget.dataset.id;
    const salonId = this.data.id;
    if (!salonId || !serviceId) return;
    analytics.track('service_click', { salonId, serviceId });
    wx.navigateTo({ url: `/pages/booking/booking?id=${encodeURIComponent(salonId)}&serviceId=${encodeURIComponent(serviceId)}` });
  },

  openStaff(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    navigation.navigateTo(`/pages/staff/staff?id=${encodeURIComponent(id)}&salonId=${encodeURIComponent(this.data.id)}`);
  },

  // 未登录时由预约页打开登录页，登录成功后直接停在预约页继续（与点击套餐卡片预约一致），不必回到本页再点一次。
  book() {
    if (!this.data.id) return;
    wx.navigateTo({ url: `/pages/booking/booking?id=${encodeURIComponent(this.data.id)}` });
  }
});

function starIcons(value) {
  const rating = Math.max(0, Math.min(5, Number(value) || 0));
  const full = Math.floor(rating);
  const hasHalf = rating > full;
  return Array.from({ length: 5 }, (_, index) => {
    if (index < full) return '/assets/icons/star_gold.png';
    if (index === full && hasHalf) return '/assets/icons/star_half_gold.png';
    return '/assets/icons/star_border_gold.png';
  });
}

function serviceImageUrls(service = {}) {
  return Array.isArray(service.imageUrls) ? service.imageUrls : [service.imageUrl].filter(Boolean);
}

function salonCoordinates(salon = {}) {
  const location = salon.location || {};
  const geoCoordinates = salon.geoLocation && salon.geoLocation.coordinates;
  const latitudeValue = location.latitude ?? location.lat ?? (geoCoordinates && geoCoordinates[1]);
  const longitudeValue = location.longitude ?? location.lng ?? location.lon ?? (geoCoordinates && geoCoordinates[0]);
  if (latitudeValue === '' || longitudeValue === '') return null;
  const latitude = Number(latitudeValue);
  const longitude = Number(longitudeValue);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}
