const { onShareAppMessage } = require('../../utils/share');
const api = require('../../utils/api');
const { markReviewHelpful } = require('../../utils/reviewHelpful');
const { formatReviewDate } = require('../../utils/reviewDate');
const ad = require('../../utils/ad');
const analytics = require('../../utils/analytics');
const { formatFen } = require('../../utils/money');
const { ratingDisplay } = require('../../utils/rating');
const { serviceTagLabels } = require('../../utils/serviceTags');
const { staffRoleLabel } = require('../../utils/staffRoles');
const { afterSalesPolicyLabels } = require('../../utils/afterSalesPolicies');

Page({
  onShareAppMessage,

  data: {
    id: '',
    salon: null,
    isFavorite: false,
    currentPromoIndex: 0,
    reviewCount: 3,
    visibleReviews: [],
    relatedSalons: [],
    loading: true,
    ad: ad.DEFAULT
  },

  onLoad(query) {
    this.setData({ id: query.id || '' });
    ad.load().then((config) => this.setData({ ad: config }));
    this.load();
  },

  onUnload() {
    this.reviewFeedbackDisposed = true;
  },

  markReviewHelpful(e) {
    return markReviewHelpful(this, 'visibleReviews', e);
  },

  async load() {
    try {
      const salon = await api.request(`/salons/${this.data.id}`);
      salon.image = await api.displayImageUrl(api.salonImage(salon), 960);
      salon.promoImages = await Promise.all((salon.promoImages || salon.images || []).map((image) => api.displayImageUrl(image, 960)));
      if (!salon.promoImages.length && salon.image) salon.promoImages = [salon.image];
      salon.openingHoursText = salon.openingHours || '暂无营业时间';
      salon.weeklyClosedDaysText = this.formatWeeklyClosedDays(salon.weeklyClosedDays);
      salon.afterSalesPolicies = afterSalesPolicyLabels(salon.afterSalesPolicyIds);
      salon.phoneText = salon.phone || '暂无电话';
      salon.addressText = this.formatAddress(salon.address);
      salon.descriptionText = salon.fullDescription || salon.description || '暂无详细描述';
      salon.reviews = await Promise.all((salon.reviews || []).map((review) => this.normalizeReview(review)));
      salon.reviewTags = (salon.reviewTags || []).filter((tag) => tag.name && Number(tag.count) > 0);
      salon.reviewTotalText = salon.reviewCount;
      Object.assign(salon, ratingDisplay(salon.rating, salon.reviewTotalText));
      salon.starIcons = starIcons(salon.hasRating ? salon.ratingText : 5);
      salon.services = await Promise.all((salon.services || []).map(async (service) => {
        const imageUrls = Array.isArray(service.imageUrls) ? service.imageUrls : [service.imageUrl].filter(Boolean);
        return {
          ...service,
          imageUrls,
          imageUrl: await api.displayImageUrl(imageUrls[0] || '', 480),
          tags: serviceTagLabels(service.tagIds),
          noteText: service.note || service.description || '',
          durationText: this.formatDuration(service.durationMinutes),
          priceText: formatFen(service.priceFen)
        };
      }));
      salon.staff = await Promise.all((salon.staff || []).map(async (staff) => ({
        ...staff,
        imageUrl: await api.displayImageUrl(staff.imageUrl, 240),
        roleText: staffRoleLabel(staff.roleId),
        experienceText: staff.experience || '',
        bioText: staff.bio || staff.description || '暂无简介'
      })));
      salon.latestPosts = await Promise.all((salon.latestPosts || []).map((post) => this.normalizePost(post, salon.services)));
      salon.hasMorePosts = salon.hasMorePosts === true;
      this.setData({ salon, visibleReviews: salon.reviews.slice(0, this.data.reviewCount) });
      this.loadFavoriteState();
      this.loadRelatedSalons(salon);
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadRelatedSalons(salon) {
    const coordinates = salonCoordinates(salon);
    if (!coordinates) return;
    try {
      const { latitude, longitude } = coordinates;
      const result = await api.requestPage(`/salons?latitude=${latitude}&longitude=${longitude}`, { page: 1, limit: 10 });
      const relatedSalons = await Promise.all(result.items
        .filter((item) => item.id !== this.data.id)
        .slice(0, 9)
        .map(async (item) => ({
          id: item.id,
          name: item.name,
          description: item.description || '',
          image: await api.displayImageUrl(api.salonImage(item), 480),
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
      ...review,
      helpfulCount: Number(review.helpfulCount) || 0,
      helpful: false, // 感谢提示仅表示本次页面内提交成功，不恢复历史反馈状态。
      helpfulSubmitting: false,
      userText: review.user || review.userName || review.phone || '用户',
      avatarUrl: api.thumbnailUrl(review.avatarUrl, 160),
      ratingText: review.rating || 5,
      starIcons: starIcons(review.rating || 5),
      serviceText: review.serviceName || review.service || '染发+修复',
      staffText: review.staffName || review.staff || 'Sato',
      dateText: formatReviewDate(review.createdAt || review.date),
      imageUrls: await Promise.all(images.map((image) => api.displayImageUrl(image, 360)))
    };
  },

  async normalizePost(post, services) {
    const service = post.serviceId ? (services || []).find((item) => item.id === post.serviceId) : null;
    return {
      ...post,
      relatedService: service ? { ...service, noteText: service.noteText.trim().replace(/\s*[\r\n]+\s*/g, '，') } : null,
      authorImageUrl: await api.displayImageUrl(post.authorImageUrl, 160),
      imageUrls: await Promise.all((post.imageUrls || []).map((image) => api.displayImageUrl(image, 480))),
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
    try {
      const favorites = await api.request('/favorites/ids');
      const isFavorite = Array.isArray(favorites.salonIds) && favorites.salonIds.includes(this.data.id);
      this.setData({ isFavorite });
    } catch (_) {}
  },

  async toggleFavorite() {
    if (!api.requireLogin()) return;
    try {
      await api.request(`/favorites/${encodeURIComponent(this.data.id)}`, {
        method: this.data.isFavorite ? 'DELETE' : 'PUT'
      });
      const isFavorite = !this.data.isFavorite;
      this.setData({ isFavorite });
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' });
    }
  },

  callPhone() {
    if (!this.data.salon.phone) return;
    wx.makePhoneCall({ phoneNumber: this.data.salon.phone });
  },

  openMap() {
    const salon = this.data.salon || {};
    const coordinates = salonCoordinates(salon);
    if (!coordinates) {
      wx.showToast({ title: '商家暂未配置导航位置', icon: 'none' });
      return;
    }
    wx.openLocation({
      ...coordinates,
      name: salon.name || '预约门店',
      address: salon.address || salon.addressText || '',
      scale: 16,
      fail: () => wx.showToast({ title: '地图打开失败', icon: 'none' })
    });
  },

  previewImage(e) {
    api.previewImage({ urls: this.data.salon.promoImages, current: e.currentTarget.dataset.url });
  },

  previewHeroImage() {
    const current = this.data.salon.image;
    if (current) api.previewImage({ urls: [current], current });
  },

  onPromoChange(e) {
    this.setData({ currentPromoIndex: e.detail.current || 0 });
  },

  previewReviewImage(e) {
    const review = this.data.visibleReviews[Number(e.currentTarget.dataset.reviewIndex)] || {};
    api.previewImage({ urls: review.imageUrls || [], current: e.currentTarget.dataset.url });
  },

  previewPostImage(e) {
    const post = this.data.salon.latestPosts[Number(e.currentTarget.dataset.postIndex)] || {};
    api.previewImage({ urls: post.imageUrls || [], current: e.currentTarget.dataset.url });
  },

  bookPostService(e) {
    const serviceId = e.currentTarget.dataset.id;
    if (!serviceId || !api.requireLogin()) return;
    wx.navigateTo({ url: `/pages/booking/booking?id=${encodeURIComponent(this.data.id)}&serviceId=${encodeURIComponent(serviceId)}` });
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
    const remainingImages = await Promise.all(service.imageUrls.slice(1).map((image) => api.displayImageUrl(image)));
    api.previewImage({ urls: [service.imageUrl, ...remainingImages], current: service.imageUrl });
  },

  openStaff(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/staff/staff?id=${encodeURIComponent(id)}&salonId=${encodeURIComponent(this.data.id)}` });
  },

  book() {
    if (!api.requireLogin()) return;
    wx.navigateTo({ url: `/pages/booking/booking?id=${this.data.id}` });
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
