const api = require('../../utils/api');
const bookingSocket = require('../../utils/bookingSocket');
const layout = require('../../utils/layout');
const ad = require('../../utils/ad');
const analytics = require('../../utils/analytics');
const { formatFen } = require('../../utils/money');
const { ratingDisplay } = require('../../utils/rating');
const { PROMOTION_CATEGORIES, promotionCategory } = require('../../utils/promotionCategories');
const TAB_BAR_SCROLL_TRIGGER = 8;
const DEFAULT_SERVICE_LOCATION = {
  latitude: 39.9042,
  longitude: 116.4074,
  locationText: '选择定位'
};
const CAMPAIGN_CACHE_MS = 5 * 60 * 1000;
const INITIAL_SALON_CARD_COUNT = 10;
const SALON_PAGE_SIZE = 10;
const loadingSalonCards = () => Array.from({ length: INITIAL_SALON_CARD_COUNT }, (_, index) => ({
  cardKey: `salon-card-${index}`,
  isPlaceholder: true,
  lightActive: false
}));
let campaignCache;

Page({
  data: {
    salons: [],
    filteredSalons: [],
    visibleSalons: [],
    salonCards: loadingSalonCards(),
    showRecommendedPackages: false,
    recommendedPackages: [],
    salonCategories: PROMOTION_CATEGORIES,
    favorites: [],
    suggestions: [],
    loading: true,
    loadingMore: false,
    refreshing: false,
    errorMessage: '',
    locating: false,
    latitude: DEFAULT_SERVICE_LOCATION.latitude,
    longitude: DEFAULT_SERVICE_LOCATION.longitude,
    locationText: DEFAULT_SERVICE_LOCATION.locationText,
    keyword: '',
    salonSort: 'distance',
    visibleCount: SALON_PAGE_SIZE,
    salonPage: 0,
    hasMoreSalons: false,
    statusBarHeight: 0,
    navBarHeight: 44,
    appBarHeight: 148,
    locatedOnce: false,
    locationIsFuzzy: true,
    unreadMessageCount: 0,
    supportHidden: false,
    newUserGiftVisible: false,
    newUserGiftImage: '',
    newUserGiftDismissed: false,
    claimingNewUserGift: false,
    ad: ad.DEFAULT
  },

  onLoad() {
    this.setNavSize();
    this.locate();
  },

  onReady() {
    this.observeSalonCards();
  },

  setNavSize() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const searchHeight = 103 * ((info.windowWidth || 375) / 750);
    this.setData(layout.appBarSize(searchHeight));
  },

  onShow() {
    analytics.track('home_exposure');
    if (this.unsubscribeBookingSocket) this.unsubscribeBookingSocket();
    this.unsubscribeBookingSocket = null;
    this.tabBarScrollAnchor = 0;
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) tabBar.show();
    this.setData({ supportHidden: false });
    ad.load().then((config) => this.setData({ ad: config }));
    this.loadNewUserGift();
    this.loadFavorites(false);
    this.loadUnreadMessages();
    const session = api.session();
    if (session && session.token) {
      this.unsubscribeBookingSocket = bookingSocket.subscribe((event) => {
        if (event.event === 'booking.created' || event.event === 'booking.updated') {
          this.loadUnreadMessages();
        }
      });
    }
  },

  onHide() {
    clearTimeout(this.supportTimer);
    if (this.unsubscribeBookingSocket) this.unsubscribeBookingSocket();
    this.unsubscribeBookingSocket = null;
  },

  onUnload() {
    clearTimeout(this.supportTimer);
    if (this.salonCardObserver) this.salonCardObserver.disconnect();
    if (this.unsubscribeBookingSocket) this.unsubscribeBookingSocket();
    this.unsubscribeBookingSocket = null;
  },

  onPullDownRefresh() {
    this.loadSalons().finally(() => wx.stopPullDownRefresh());
  },

  refresh() {
    this.setData({ refreshing: true });
    this.loadSalons().finally(() => this.setData({ refreshing: false }));
  },

  async locate() {
    if (this.data.locating) return;
    this.setData({ locating: true });
    wx.getFuzzyLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({
          latitude: res.latitude,
          longitude: res.longitude,
          locatedOnce: true,
          locationIsFuzzy: true
        });
        this.loadSalons();
      },
      fail: () => {
        this.setData({
          ...DEFAULT_SERVICE_LOCATION,
          locatedOnce: false
        });
        this.loadSalons();
      },
      complete: () => this.setData({ locating: false })
    });
  },

  async loadSalons() {
    const version = (this.salonListVersion || 0) + 1;
    this.salonListVersion = version;
    this.setData({ loading: !this.data.visibleSalons.length, loadingMore: false, errorMessage: '' });
    try {
      const result = await api.requestPage(this.salonListPath(), { page: 1, limit: SALON_PAGE_SIZE });
      const normalizedSalons = await this.normalizeSalonPage(result.items);
      if (version !== this.salonListVersion) return;
      this.setData({
        salons: normalizedSalons,
        visibleCount: normalizedSalons.length,
        salonPage: 1,
        hasMoreSalons: result.hasMore
      });
      this.applyFilter();
      if (this.data.showRecommendedPackages) this.loadRecommendedPackages(normalizedSalons);
    } catch (err) {
      if (version !== this.salonListVersion) return;
      this.setData({
        errorMessage: err.message || '网络请求失败',
        salonCards: this.data.salons.length ? this.data.salonCards : []
      }, () => this.observeSalonCards());
      wx.showToast({ title: err.message, icon: 'none' });
    } finally {
      if (version === this.salonListVersion) this.setData({ loading: false });
    }
  },

  salonListPath() {
    const { latitude, longitude } = this.data;
    const keyword = this.data.keyword.trim();
    return `/salons?latitude=${latitude}&longitude=${longitude}${keyword ? `&keyword=${encodeURIComponent(keyword)}` : ''}${this.data.salonSort === 'rating' ? '&sort=rating' : ''}`;
  },

  changeSalonSort(e) {
    const sort = e.currentTarget.dataset.sort;
    if (!['distance', 'rating'].includes(sort) || sort === this.data.salonSort) return;
    this.setData({ salonSort: sort, hasMoreSalons: false });
    this.loadSalons();
  },

  async normalizeSalonPage(salons) {
    return Promise.all(salons.map(async (source) => {
      const salon = this.normalizeSalon(source);
      try {
        return { ...salon, image: await api.displayImageUrl(api.salonImage(source)) };
      } catch (_) {
        return salon;
      }
    }));
  },

  normalizeSalon(salon) {
    return {
      ...salon,
      image: '',
      nameText: salon.name || '未知沙龙',
      addressText: salon.address || '',
      descriptionText: salon.description || '暂无描述',
      tags: Array.isArray(salon.tags) ? salon.tags.filter(Boolean) : [],
      ...ratingDisplay(salon.rating, salon.reviewCount),
      distanceText: this.formatDistance(salon.distanceKm)
    };
  },

  async loadRecommendedPackages(salons) {
    const requestId = (this.recommendationRequestId || 0) + 1;
    this.recommendationRequestId = requestId;
    try {
      const details = await Promise.all(salons.slice(0, 6).map((salon) =>
        api.request(`/salons/${encodeURIComponent(salon.id)}`).catch(() => null)
      ));
      const packages = details.flatMap((salon, index) => {
        const service = salon && salon.services && salon.services[0];
        if (!service) return [];
        const summary = salons[index];
        return [{
          id: `${salon.id}:${service.id}`,
          salonId: salon.id,
          serviceId: service.id,
          salonName: salon.name || '未知沙龙',
          salonDescription: salon.description || '暂无简介',
          distanceText: summary.distanceText,
          serviceName: service.name || '套餐',
          serviceNote: service.note || '',
          priceText: formatFen(service.priceFen),
          image: api.displayImageUrl(api.salonImage(salon)),
          isFavorite: this.data.favorites.includes(salon.id)
        }];
      });
      const normalizedPackages = await Promise.all(packages.map(async (item) => ({
        ...item,
        image: await item.image
      })));
      const shuffledPackages = normalizedPackages.slice();
      for (let index = shuffledPackages.length - 1; index > 0; index -= 1) {
        const targetIndex = Math.floor(Math.random() * (index + 1));
        [shuffledPackages[index], shuffledPackages[targetIndex]] = [shuffledPackages[targetIndex], shuffledPackages[index]];
      }
      if (shuffledPackages.length > 1 && shuffledPackages.every((item, index) => item.id === normalizedPackages[index].id)) {
        shuffledPackages.push(shuffledPackages.shift());
      }
      if (requestId === this.recommendationRequestId) {
        this.setData({ recommendedPackages: shuffledPackages });
      }
    } catch (_) {
      if (requestId === this.recommendationRequestId) {
        this.setData({ recommendedPackages: [] });
      }
    }
  },

  formatDistance(distanceKm) {
    const distance = Number(distanceKm);
    if (!this.data.locatedOnce || !distance) return '';
    const prefix = this.data.locationIsFuzzy ? '附近约 ' : '距离你 ';
    return distance < 1 ? `${prefix}${Math.round(distance * 1000)} m` : `${prefix}${distance.toFixed(1)} km`;
  },

  async loadFavorites(showError = true) {
    const session = api.session();
    if (!(session && session.token)) return;
    try {
      const result = await api.request('/favorites/ids');
      this.setData({ favorites: Array.isArray(result.salonIds) ? result.salonIds : [] });
      this.applyFilter();
    } catch (err) {
      if (showError) wx.showToast({ title: err.message, icon: 'none' });
    }
  },

  async loadUnreadMessages() {
    const session = api.session();
    if (!(session && session.token)) {
      this.setData({ unreadMessageCount: 0 });
      return;
    }
    try {
      const result = await api.request('/booking-messages/unread-count');
      this.setData({ unreadMessageCount: Number(result.count) || 0 });
    } catch (_) {
      this.setData({ unreadMessageCount: 0 });
    }
  },

  async loadNewUserGift() {
    const session = api.session();
    const cacheKey = session && session.token ? `authenticated:${session.token}` : 'anonymous';
    try {
      let image;
      if (campaignCache && campaignCache.key === cacheKey && campaignCache.expiresAt > Date.now()) {
        image = campaignCache.image;
      } else {
        const gift = await api.request(session && session.token
          ? '/auth/coupon-campaign'
          : '/coupon-campaign');
        image = gift.enabled && gift.promotionImageUrl
          ? await api.displayImageUrl(gift.promotionImageUrl)
          : '';
        campaignCache = {
          key: cacheKey,
          image,
          expiresAt: Date.now() + CAMPAIGN_CACHE_MS
        };
      }
      this.setData({
        newUserGiftVisible: Boolean(image) && !this.data.newUserGiftDismissed,
        newUserGiftImage: image
      });
    } catch (_) {
      this.setData({ newUserGiftVisible: false, newUserGiftImage: '' });
    }
  },

  dismissNewUserGift() {
    this.setData({
      newUserGiftVisible: false,
      newUserGiftDismissed: true
    });
  },

  async claimNewUserGift() {
    if (this.data.claimingNewUserGift || !api.requireLogin()) return;
    this.setData({ claimingNewUserGift: true });
    try {
      await api.request('/auth/coupon-campaign/claim', { method: 'POST' });
      campaignCache = null;
      this.setData({ newUserGiftVisible: false });
      wx.showToast({ title: '新人礼包领取成功', icon: 'success' });
      wx.switchTab({
        url: '/pages/profile/profile',
        success() {
          const pages = getCurrentPages();
          const profile = pages[pages.length - 1];
          if (profile && profile.route === 'pages/profile/profile') {
            profile.setData({ activeTab: 'coupons' });
          }
        }
      });
    } catch (err) {
      wx.showToast({ title: err.message || '领取失败，请稍后重试', icon: 'none' });
    } finally {
      this.setData({ claimingNewUserGift: false });
    }
  },

  onKeyword(e) {
    const keyword = e.detail.value;
    this.setData({ keyword });
    if (!keyword.trim()) {
      this.setData({ suggestions: [] });
      this.loadSalons();
      return;
    }
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.loadSuggestions(keyword), 250);
  },

  async loadSuggestions(keyword) {
    try {
      const { latitude, longitude } = this.data;
      const suggestions = await api.request(`/salons/suggestions?keyword=${encodeURIComponent(keyword)}&latitude=${latitude}&longitude=${longitude}`);
      const normalizedSuggestions = await Promise.all(suggestions.slice(0, 5).map((salon) => this.normalizeSalon(salon)));
      if (keyword !== this.data.keyword) return;
      this.setData({ suggestions: normalizedSuggestions });
    } catch (_) {
      if (keyword === this.data.keyword) this.setData({ suggestions: [] });
    }
  },

  clearSearch() {
    clearTimeout(this.searchTimer);
    this.searchTimer = null;
    this.setData({ keyword: '', suggestions: [] });
    return this.loadSalons();
  },

  chooseSuggestion(e) {
    this.setData({ keyword: e.currentTarget.dataset.name, suggestions: [] });
    return this.submitSearch();
  },

  submitSearch() {
    this.setData({ suggestions: [] });
    return this.loadSalons();
  },

  applyFilter(onRendered) {
    const keyword = this.data.keyword.trim().toLowerCase();
    const favoriteSet = new Set(this.data.favorites);
    const filteredSalons = this.data.salons
      .filter((salon) => !keyword || String(salon.name || '').toLowerCase().includes(keyword))
      .map((salon) => {
        const isFavorite = favoriteSet.has(salon.id);
        return { ...salon, isFavorite };
      });
    const visibleSalons = filteredSalons.slice(0, this.data.visibleCount);
    this.setData({
      filteredSalons,
      visibleSalons,
      salonCards: visibleSalons.map((salon, index) => ({
        ...salon,
        cardKey: `salon-card-${index}`,
        isPlaceholder: false,
        lightActive: Boolean(this.data.salonCards[index] && this.data.salonCards[index].lightActive)
      })),
      recommendedPackages: this.data.recommendedPackages.map((item) => ({
        ...item,
        isFavorite: favoriteSet.has(item.salonId)
      }))
    }, () => {
      this.observeSalonCards();
      if (onRendered) onRendered();
    });
  },

  observeSalonCards() {
    const cardCount = this.data.salonCards.length;
    if (!this.createIntersectionObserver || cardCount === this.observedSalonCardCount) return;
    if (this.salonCardObserver) this.salonCardObserver.disconnect();
    this.observedSalonCardCount = cardCount;
    if (!cardCount) {
      this.salonCardObserver = null;
      return;
    }
    this.salonCardObserver = this.createIntersectionObserver({ observeAll: true, thresholds: [0, 0.01] });
    this.salonCardObserver
      .relativeTo('.list')
      .observe('.salon-card', (entry) => {
        const index = Number(entry.dataset.cardIndex);
        const card = this.data.salonCards[index];
        const lightActive = entry.intersectionRatio > 0;
        if (!card || card.lightActive === lightActive) return;
        this.setData({ [`salonCards[${index}].lightActive`]: lightActive });
      });
  },

  async loadMore() {
    if (this.data.loading || this.data.loadingMore || !this.data.hasMoreSalons) return;
    const version = this.salonListVersion;
    const page = this.data.salonPage + 1;
    this.setData({ loadingMore: true });
    try {
      const result = await api.requestPage(this.salonListPath(), { page, limit: SALON_PAGE_SIZE });
      const nextSalons = await this.normalizeSalonPage(result.items);
      if (version !== this.salonListVersion) return;
      const knownIds = new Set(this.data.salons.map((salon) => salon.id));
      const newSalons = nextSalons.filter((salon) => !knownIds.has(salon.id));
      if (nextSalons.length && !newSalons.length) {
        throw new Error('未加载到新店铺，请稍后重试');
      }
      const salons = this.data.salons.concat(newSalons);
      this.setData({
        salons,
        visibleCount: salons.length,
        salonPage: page,
        hasMoreSalons: result.hasMore
      });
      await new Promise(resolve => this.applyFilter(resolve));
    } catch (err) {
      if (version === this.salonListVersion) {
        wx.showToast({ title: err.message || '加载失败，请稍后重试', icon: 'none' });
      }
    } finally {
      if (version === this.salonListVersion) this.setData({ loadingMore: false });
    }
  },

  onListScroll(e) {
    const scrollTop = Math.max(0, Number(e.detail.scrollTop) || 0);
    const distance = scrollTop - this.tabBarScrollAnchor;
    if (scrollTop === 0 || Math.abs(distance) >= TAB_BAR_SCROLL_TRIGGER) {
      this.tabBarScrollAnchor = scrollTop;
      const tabBar = this.getTabBar && this.getTabBar();
      if (tabBar) {
        if (scrollTop === 0 || distance < 0) tabBar.show();
        else if (distance > 0) tabBar.hide();
      }
    }
    clearTimeout(this.supportTimer);
    if (!this.data.supportHidden) this.setData({ supportHidden: true });
    this.supportTimer = setTimeout(() => {
      this.setData({ supportHidden: false });
    }, 180);
  },

  scrollToTop() {
    this.createSelectorQuery()
      .select('#home-list')
      .node()
      .exec((result) => {
        const scrollView = result[0] && result[0].node;
        if (scrollView) scrollView.scrollTo({ top: 0, animated: true, duration: 500 });
      });
  },

  async toggleFavorite(e) {
    if (!api.requireLogin()) return;
    try {
      const salon = this.data.salons.find((item) => item.id === e.currentTarget.dataset.id);
      if (!salon) return;
      await api.request(`/favorites/${encodeURIComponent(salon.id)}`, {
        method: this.data.favorites.includes(salon.id) ? 'DELETE' : 'PUT'
      });
      await this.loadFavorites();
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' });
    }
  },

  openDetail(e) {
    const salonId = e.currentTarget.dataset.id;
    if (!salonId) return;
    analytics.track('salon_detail_click', { salonId });
    wx.navigateTo({ url: `/pages/detail/detail?id=${salonId}` });
  },

  openRecommendedPackage(e) {
    const { salonId, serviceId } = e.currentTarget.dataset;
    analytics.track('service_click', { salonId, serviceId });
    wx.navigateTo({
      url: `/pages/booking/booking?id=${encodeURIComponent(salonId)}&serviceId=${encodeURIComponent(serviceId)}`
    });
  },

  openSalonCategory(e) {
    const category = promotionCategory(String(e.currentTarget.dataset.category || ''));
    if (!category) return;
    const location = this.data.locatedOnce
      ? `&latitude=${this.data.latitude}&longitude=${this.data.longitude}`
      : '';
    wx.navigateTo({
      url: `/pages/style-gallery/style-gallery?category=${encodeURIComponent(category.id)}${location}`
    });
  },

  openMessages() {
    if (!api.requireLogin()) return;
    wx.navigateTo({ url: '/pages/messages/messages' });
  },

  openSupport() {
    wx.navigateTo({ url: '/pages/support/support' });
  },

  openLocation() {
    wx.navigateTo({
      url: `/pages/location/location?text=${encodeURIComponent(this.data.locationText)}&latitude=${this.data.latitude}&longitude=${this.data.longitude}`
    });
  }
});
