const api = require('../../utils/api');
const ad = require('../../utils/ad');
const analytics = require('../../utils/analytics');
const { formatFen } = require('../../utils/money');

Page({
  data: {
    id: '',
    salon: null,
    isFavorite: false,
    currentPromoIndex: 0,
    reviewCount: 3,
    visibleReviews: [],
    loading: true,
    ad: ad.DEFAULT
  },

  onLoad(query) {
    this.setData({ id: query.id || '' });
    ad.load().then((config) => this.setData({ ad: config }));
    this.load();
  },

  async load() {
    try {
      const salon = await api.request(`/salons/${this.data.id}`);
      salon.image = await api.displayImageUrl(api.salonImage(salon));
      salon.promoImages = await Promise.all((salon.promoImages || salon.images || []).map(api.displayImageUrl));
      if (!salon.promoImages.length && salon.image) salon.promoImages = [salon.image];
      salon.ratingText = salon.rating || '4.8';
      salon.starIcons = starIcons(salon.ratingText);
      salon.openingHoursText = salon.openingHours || '暂无营业时间';
      salon.phoneText = salon.phone || '暂无电话';
      salon.addressText = this.formatAddress(salon.address);
      salon.descriptionText = salon.fullDescription || salon.description || '暂无详细描述';
      salon.reviews = await Promise.all((salon.reviews || []).map((review) => this.normalizeReview(review)));
      salon.reviewTotalText = salon.reviewCount || salon.reviews.length || 0;
      salon.services = await Promise.all((salon.services || []).map(async (service) => ({
        ...service,
        imageUrl: await api.displayImageUrl(service.imageUrl),
        tags: service.tags || service.categories || [],
        noteText: service.note || service.description || '',
        durationText: this.formatDuration(service.durationMinutes),
        priceText: formatFen(service.priceFen)
      })));
      salon.staff = await Promise.all((salon.staff || []).map(async (staff) => ({
        ...staff,
        imageUrl: await api.displayImageUrl(staff.imageUrl),
        roleText: staff.role || '',
        experienceText: staff.experience || '',
        bioText: staff.bio || staff.description || '暂无简介'
      })));
      this.setData({ salon, visibleReviews: salon.reviews.slice(0, this.data.reviewCount) });
      this.loadFavoriteState();
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async normalizeReview(review) {
    const images = review.imageUrls || review.images || [review.imageUrl || review.image].filter(Boolean);
    return {
      ...review,
      userText: review.user || review.userName || review.phone || '用户',
      avatarUrl: api.mediaUrl(review.avatarUrl),
      ratingText: review.rating || 5,
      starIcons: starIcons(review.rating || 5),
      serviceText: review.serviceName || review.service || '染发+修复',
      staffText: review.staffName || review.staff || 'Sato',
      dateText: this.formatDate(review.createdAt || review.date),
      imageUrls: await Promise.all(images.map(api.displayImageUrl))
    };
  },

  formatDuration(value) {
    if (!value) return '';
    return /^\d+$/.test(String(value)) ? `${value}分钟` : String(value).replace(/\s*min$/i, '分钟');
  },

  formatAddress(value) {
    if (!value) return '地址未知';
    const address = String(value).trim();
    const match = address.match(/^(?:(?:北京|天津|上海|重庆)市|.+?(?:省|自治区|特别行政区))?(?:.+?(?:市|自治州|地区|盟))?.+?(?:区|县|旗|市)(.+)$/);
    return match && match[1].trim() || address;
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
      const favorites = await api.request('/favorites');
      const isFavorite = favorites.some((salon) => salon.id === this.data.id);
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
    wx.previewImage({ urls: this.data.salon.promoImages, current: e.currentTarget.dataset.url });
  },

  onPromoChange(e) {
    this.setData({ currentPromoIndex: e.detail.current || 0 });
  },

  previewReviewImage(e) {
    const review = this.data.visibleReviews[Number(e.currentTarget.dataset.reviewIndex)] || {};
    wx.previewImage({ urls: review.imageUrls || [], current: e.currentTarget.dataset.url });
  },

  showMoreReviews() {
    const reviewCount = this.data.reviewCount + 3;
    this.setData({
      reviewCount,
      visibleReviews: this.data.salon.reviews.slice(0, reviewCount)
    });
  },

  openService(e) {
    const serviceId = e.currentTarget.dataset.id;
    analytics.track('service_click', { salonId: this.data.id, serviceId });
    wx.navigateTo({ url: `/pages/booking/booking?id=${this.data.id}&serviceId=${serviceId}` });
  },

  openStaff(e) {
    wx.navigateTo({ url: `/pages/staff/staff?id=${e.currentTarget.dataset.id}&salonId=${this.data.id}` });
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
