const { onShareAppMessage } = require('../../utils/share');
const api = require('../../utils/api');
const bookingSocket = require('../../utils/bookingSocket');
const layout = require('../../utils/layout');
const ad = require('../../utils/ad');
const couponCampaign = require('../../utils/couponCampaign');
const analytics = require('../../utils/analytics');
const favoriteStore = require('../../utils/favorites');
const salonDetail = require('../../utils/salonDetail');
const unreadMessages = require('../../utils/unreadMessages');
const salonListCache = require('../../utils/salonListCache');
const { ratingDisplay } = require('../../utils/rating');
const { formatFen } = require('../../utils/money');
const { PROMOTION_CATEGORIES, promotionCategory } = require('../../utils/promotionCategories');
const TAB_BAR_SCROLL_TRIGGER = 8;
const DEFAULT_SERVICE_LOCATION = {
  latitude: 39.9042,
  longitude: 116.4074,
  locationText: '选择定位'
};
const LAST_LOCATION_KEY = 'homeLastLocation';
// 模糊定位本身只有公里级精度；移动不足这个距离时，附近店铺列表不会有实质变化。
const LOCATION_REFRESH_DISTANCE_M = 500;
const INITIAL_SALON_CARD_COUNT = 10;
const SALON_PAGE_SIZE = 10;
const SALON_VISIBILITY_BATCH_MS = 16;
const SALON_CARD_IMAGE_LIMIT = 5;
const SALON_TAG_CLASSES = ['salon-tag-neon', 'salon-tag-nature'];
const loadingSalonCards = () => Array.from({ length: INITIAL_SALON_CARD_COUNT }, (_, index) => ({
  cardKey: `salon-card-${index}`,
  isPlaceholder: true
}));

Page({
  onShareAppMessage,

  data: {
    salonCount: 0,
    salonCards: loadingSalonCards(),
    visibleSalonCards: Array(INITIAL_SALON_CARD_COUNT).fill(false),
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
    // keyword 是输入框里的草稿；searchKeyword 是已提交、列表请求与分页实际使用的关键词。
    keyword: '',
    searchKeyword: '',
    salonSort: 'distance',
    salonPage: 0,
    hasMoreSalons: false,
    statusBarHeight: 0,
    navBarHeight: 44,
    appBarHeight: 148,
    locatedOnce: false,
    locationFailed: false,
    locationIsFuzzy: true,
    unreadMessageCount: 0,
    supportHidden: false,
    // 列表滚动超过一屏后才显示返回顶部按钮。
    showBackToTop: false,
    newUserGiftVisible: false,
    newUserGiftImage: '',
    newUserGiftDismissed: false,
    claimingNewUserGift: false,
    ad: ad.DEFAULT
  },

  onLoad() {
    this.setNavSize();
    const lastLocation = readLastLocation();
    if (lastLocation) {
      // 首屏先按上次定位加载，不等待本次定位；定位返回后位置变化明显才重新加载。
      this.restoredLocation = lastLocation;
      this.setData({
        latitude: lastLocation.latitude,
        longitude: lastLocation.longitude,
        locatedOnce: true,
        locationFailed: false,
        locationIsFuzzy: true
      });
      this.showCachedSalons(lastLocation);
      this.loadSalons();
    }
    this.locate();
  },

  // 冷启动时先展示上次在同一位置读取的第一页，实时结果返回后整体替换。
  // 展示缓存期间 hasMoreSalons 保持 false，避免把实时的第二页拼到缓存的第一页后面。
  async showCachedSalons(location) {
    const items = salonListCache.read(location);
    if (!items) return;
    const salons = await this.normalizeSalonPage(items);
    if (this.salonListLoaded || this.data.searchKeyword || this.data.salonSort !== 'distance') return;
    this.salons = salons;
    this.renderSalons(salons);
  },

  onReady() {
    this.observeSalonCards();
  },

  setNavSize() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    this.backToTopThreshold = info.windowHeight || 600;
    const searchHeight = 103 * ((info.windowWidth || 375) / 750);
    this.setData(layout.appBarSize(searchHeight));
  },

  onShow() {
    analytics.track('home_exposure');
    if (this.unsubscribeBookingSocket) this.unsubscribeBookingSocket();
    this.unsubscribeBookingSocket = null;
    this.tabBarScrollAnchor = 0;
    this.listScrollHeight = undefined;
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) tabBar.show();
    this.setData({ supportHidden: false });
    if (this.locationChanged) {
      this.locationChanged = false;
      // 新定位使用新列表，返回可见后先清除旧列表的滚动位置。
      this.scrollToTop(() => this.loadSalons());
    }
    ad.load().then((config) => this.setData({ ad: config }));
    this.loadNewUserGift();
    this.loadFavorites(false);
    this.loadUnreadMessages();
    const session = api.session();
    if (session && session.token) {
      this.unsubscribeBookingSocket = bookingSocket.subscribe((event) => {
        if (event.event === 'authenticated' || event.event === 'booking.created' || event.event === 'booking.updated') {
          this.loadUnreadMessages({ force: true });
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
    this.salonListVersion = (this.salonListVersion || 0) + 1;
    this.salonCardRender = null;
    this.stopSalonCardObserver();
    if (this.unsubscribeBookingSocket) this.unsubscribeBookingSocket();
    this.unsubscribeBookingSocket = null;
  },

  // 网络恢复后重新加载之前失败的内容。
  onNetworkRestored() {
    if (this.data.errorMessage) this.loadSalons();
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
        const restored = this.takeRestoredLocation();
        // 模糊定位照常记住，供下次冷启动先展示；但不覆盖本次已手动选择的位置。
        wx.setStorage({ key: LAST_LOCATION_KEY, data: { latitude: res.latitude, longitude: res.longitude } });
        // 等待定位期间用户已手动选点时（无论是否有缓存位置），以用户的选择为准。
        if (!this.data.locationIsFuzzy) return;
        if (restored && distanceMeters(restored, res) < LOCATION_REFRESH_DISTANCE_M) return;
        this.setData({
          latitude: res.latitude,
          longitude: res.longitude,
          locatedOnce: true,
          locationFailed: false,
          locationIsFuzzy: true
        });
        this.reloadSalonsForLocation(Boolean(restored));
      },
      fail: () => {
        const restored = this.takeRestoredLocation();
        // 定位不可用时不再沿用上次位置，与未缓存时一样回到默认城市。
        if (restored) wx.removeStorage({ key: LAST_LOCATION_KEY });
        // 用户已手动选点时，定位失败不影响手选位置，不回到默认城市。
        if (!this.data.locationIsFuzzy) return;
        this.setData({
          ...DEFAULT_SERVICE_LOCATION,
          locatedOnce: false,
          locationFailed: true
        });
        this.reloadSalonsForLocation(Boolean(restored));
      },
      complete: () => this.setData({ locating: false })
    });
  },

  takeRestoredLocation() {
    const restored = this.restoredLocation || null;
    this.restoredLocation = null;
    return restored;
  },

  reloadSalonsForLocation(listAlreadyShown) {
    // 已按上次定位展示过列表时，先清除旧列表的滚动位置再替换。
    if (listAlreadyShown) this.scrollToTop(() => this.loadSalons());
    else this.loadSalons();
  },

  async loadSalons() {
    const version = (this.salonListVersion || 0) + 1;
    this.salonListVersion = version;
    this.setData({ loading: !this.data.salonCount, loadingMore: false, errorMessage: '' });
    try {
      const result = await api.requestPage(this.salonListPath(), { page: 1, limit: SALON_PAGE_SIZE });
      const normalizedSalons = await this.normalizeSalonPage(result.items);
      if (version !== this.salonListVersion) return;
      this.salonListLoaded = true;
      this.salons = normalizedSalons;
      this.setData({
        salonPage: 1,
        hasMoreSalons: result.hasMore
      });
      this.renderSalons(normalizedSalons);
      if (!this.data.searchKeyword && this.data.salonSort === 'distance') {
        salonListCache.save({ latitude: this.data.latitude, longitude: this.data.longitude }, result.items);
      }
    } catch (err) {
      if (version !== this.salonListVersion) return;
      const updates = { errorMessage: err.message || '网络请求失败' };
      if ((this.salons || []).length) this.setData(updates);
      else this.setSalonCardData({ ...updates, salonCards: [] }, 0);
      wx.showToast({ title: err.message, icon: 'none' });
    } finally {
      if (version === this.salonListVersion) this.setData({ loading: false });
    }
  },

  salonListPath() {
    const { latitude, longitude } = this.data;
    const keyword = this.data.searchKeyword;
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
        const cardImages = await Promise.all(api.salonImages(source, SALON_CARD_IMAGE_LIMIT)
          .map((image) => api.displayImageUrl(image, 480, { webp: true })));
        return { ...salon, cardImages };
      } catch (_) {
        return salon;
      }
    }));
  },

  onSalonImageError(e) {
    const { cardIndex, imageIndex, src } = e.currentTarget.dataset;
    if (typeof src !== 'string' || this.data.salonCards[cardIndex]?.images?.[imageIndex] !== src) return;
    const fallback = api.jpegThumbnailFallback(src);
    if (fallback !== src) this.setData({ [`salonCards[${cardIndex}].images[${imageIndex}]`]: fallback });
  },

  normalizeSalon(salon) {
    const reviewCount = Math.max(0, Math.floor(Number(salon.reviewCount)) || 0);
    return {
      ...salon,
      image: '',
      cardImages: [],
      nameText: salon.name || '未知沙龙',
      addressText: salon.address || '',
      businessDistrict: typeof salon.businessDistrict === 'string' ? salon.businessDistrict.trim() : '',
      // 店铺的首页简介，卡片上紧跟在店名之后。
      introText: typeof salon.description === 'string' ? salon.description.trim() : '',
      tags: (Array.isArray(salon.tags) ? salon.tags.filter(Boolean) : []).map((text, index) => ({
        text,
        colorClass: SALON_TAG_CLASSES[index % SALON_TAG_CLASSES.length]
      })),
      ...ratingDisplay(salon.rating, salon.reviewCount),
      reviewCountText: reviewCount ? `评价 ${reviewCount}条` : '暂无评价',
      // 列表接口的可选字段：该店剪发类套餐的最低价（分），没有剪发套餐时不返回。
      cutPriceText: Number.isSafeInteger(salon.cutPriceFromFen) && salon.cutPriceFromFen > 0
        ? `剪发${formatFen(salon.cutPriceFromFen)}起`
        : '',
      distanceText: this.formatDistance(salon.distanceKm)
    };
  },

  formatDistance(distanceKm) {
    const distance = Number(distanceKm);
    if (!this.data.locatedOnce || !distance) return '';
    return distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`;
  },

  async loadFavorites(showError = true) {
    try {
      this.setData({ favorites: await favoriteStore.loadIds() });
      this.updateFavoriteCards();
    } catch (err) {
      if (showError) wx.showToast({ title: err.message, icon: 'none' });
    }
  },

  async loadUnreadMessages(options = {}) {
    try {
      this.setData({ unreadMessageCount: await unreadMessages.count(options) });
    } catch (_) {
      this.setData({ unreadMessageCount: 0 });
    }
  },

  async loadNewUserGift() {
    try {
      const image = await couponCampaign.loadPromotionImage();
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
      await couponCampaign.claim();
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
    clearTimeout(this.searchTimer);
    if (!keyword.trim()) {
      // 清空输入等同于清除搜索；未提交过关键词时列表本来就是全部店铺，不必重新请求。
      const hadSearch = Boolean(this.data.searchKeyword);
      this.setData({ suggestions: [], searchKeyword: '' });
      if (hadSearch) this.loadSalons();
      return;
    }
    this.searchTimer = setTimeout(() => this.loadSuggestions(keyword), 250);
  },

  async loadSuggestions(keyword) {
    try {
      const { latitude, longitude } = this.data;
      const suggestions = await api.request(`/salons/suggestions?keyword=${encodeURIComponent(keyword)}&latitude=${latitude}&longitude=${longitude}`);
      const normalizedSuggestions = await Promise.all(suggestions.slice(0, 5).map((salon) => this.normalizeSalon(salon)));
      // 输入已变化或已按这个关键词提交搜索时，联想结果不再展示。
      if (keyword !== this.data.keyword || keyword.trim() === this.data.searchKeyword) return;
      this.setData({ suggestions: normalizedSuggestions });
    } catch (_) {
      if (keyword === this.data.keyword) this.setData({ suggestions: [] });
    }
  },

  clearSearch() {
    clearTimeout(this.searchTimer);
    this.searchTimer = null;
    this.setData({ keyword: '', searchKeyword: '', suggestions: [] });
    return this.loadSalons();
  },

  chooseSuggestion(e) {
    this.setData({ keyword: e.currentTarget.dataset.name, suggestions: [] });
    return this.submitSearch();
  },

  submitSearch() {
    clearTimeout(this.searchTimer);
    this.searchTimer = null;
    this.setData({ suggestions: [], searchKeyword: this.data.keyword.trim() });
    return this.loadSalons();
  },

  // 搜索结果以服务端为准（列表接口按关键词筛选），这里不再按店名二次过滤，
  // 服务端调整匹配范围（如增加地址、商圈）时前端无需同步修改。
  renderSalons(salons, append = false, onRendered) {
    const favoriteSet = new Set(this.data.favorites);
    const offset = append ? this.data.salonCards.length : 0;
    const cards = salons
      .map((salon, index) => ({
        id: salon.id,
        // 没有图片时保留一个占位格，卡片高度不随图片有无变化。
        images: salon.cardImages && salon.cardImages.length ? salon.cardImages : [''],
        nameText: salon.nameText,
        introText: salon.introText,
        // 卡片只显示第一个普通标签。
        tags: (salon.tags || []).slice(0, 1),
        isFeatured: salon.isFeatured === true,
        hasRating: salon.hasRating,
        ratingText: salon.ratingText,
        reviewCountText: salon.reviewCountText,
        cutPriceText: salon.cutPriceText,
        distanceText: salon.distanceText,
        businessDistrict: salon.businessDistrict,
        addressText: salon.addressText,
        isFavorite: favoriteSet.has(salon.id),
        cardKey: `salon-card-${offset + index}`,
        isPlaceholder: false
      }));
    const updates = { salonCount: offset + cards.length };
    if (append) {
      cards.forEach((card, index) => { updates[`salonCards[${offset + index}]`] = card; });
    } else {
      updates.salonCards = cards;
    }
    this.setSalonCardData(updates, updates.salonCount, onRendered);
  },

  setSalonCardData(updates, cardCount, onRendered) {
    if (cardCount === this.data.salonCards.length) {
      this.setData(updates, onRendered);
      return;
    }

    const pending = this.stopSalonCardObserver();
    // 节点按位置复用。保留仍存在的位置，新增位置等待重新观测。
    updates.visibleSalonCards = Array.from({ length: cardCount }, (_, index) => (
      pending?.get(index) ?? this.data.visibleSalonCards[index] ?? false
    ));
    const render = {};
    this.salonCardRender = render;
    this.setData(updates, () => {
      if (this.salonCardRender === render) {
        this.salonCardRender = null;
        this.observeSalonCards();
      }
      if (onRendered) onRendered();
    });
  },

  updateFavoriteCards() {
    const favoriteSet = new Set(this.data.favorites);
    const updates = {};
    this.data.salonCards.forEach((card, index) => {
      if (card.isPlaceholder) return;
      const isFavorite = favoriteSet.has(card.id);
      if (card.isFavorite !== isFavorite) updates[`salonCards[${index}].isFavorite`] = isFavorite;
    });
    if (Object.keys(updates).length) this.setData(updates);
  },

  observeSalonCards() {
    if (!this.createIntersectionObserver || this.salonCardObserver || this.salonCardRender || !this.data.salonCards.length) return;
    const observer = this.createIntersectionObserver({ observeAll: true, thresholds: [0, 0.01] });
    const pending = new Map();
    this.salonCardObserver = observer;
    this.pendingSalonVisibility = pending;
    observer
      .relativeTo('.list')
      .observe('.salon-card', (entry) => {
        if (this.salonCardObserver !== observer) return;
        const index = Number(entry.dataset.cardIndex);
        if (!this.data.salonCards[index]) return;
        const visible = entry.intersectionRatio > 0;
        if (visible === this.data.visibleSalonCards[index]) pending.delete(index);
        else pending.set(index, visible);
        if (!pending.size || this.salonVisibilityTimer != null) return;
        this.salonVisibilityTimer = setTimeout(() => {
          this.salonVisibilityTimer = null;
          const updates = {};
          pending.forEach((visible, index) => { updates[`visibleSalonCards[${index}]`] = visible; });
          pending.clear();
          if (Object.keys(updates).length) this.setData(updates);
        }, SALON_VISIBILITY_BATCH_MS);
      });
  },

  stopSalonCardObserver() {
    const observer = this.salonCardObserver;
    const pending = this.pendingSalonVisibility;
    this.salonCardObserver = null;
    this.pendingSalonVisibility = null;
    clearTimeout(this.salonVisibilityTimer);
    this.salonVisibilityTimer = null;
    if (observer) observer.disconnect();
    return pending;
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
      const knownIds = new Set((this.salons || []).map((salon) => salon.id));
      const newSalons = nextSalons.filter((salon) => {
        if (knownIds.has(salon.id)) return false;
        knownIds.add(salon.id);
        return true;
      });
      if (nextSalons.length && !newSalons.length) {
        throw new Error('未加载到新店铺，请稍后重试');
      }
      this.salons = (this.salons || []).concat(newSalons);
      this.setData({
        salonPage: page,
        hasMoreSalons: result.hasMore
      });
      await new Promise(resolve => this.renderSalons(newSalons, true, resolve));
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
    const scrollHeight = Number(e.detail.scrollHeight);
    const contentHeightChanged = Number.isFinite(scrollHeight)
      && Number.isFinite(this.listScrollHeight)
      && scrollHeight !== this.listScrollHeight;
    if (Number.isFinite(scrollHeight)) this.listScrollHeight = scrollHeight;
    const distance = scrollTop - this.tabBarScrollAnchor;
    if (scrollTop === 0 || Math.abs(distance) >= TAB_BAR_SCROLL_TRIGGER) {
      this.tabBarScrollAnchor = scrollTop;
      const tabBar = this.getTabBar && this.getTabBar();
      if (tabBar) {
        if (scrollTop === 0 || (distance < 0 && !this.data.loadingMore && !contentHeightChanged)) tabBar.show();
        else if (distance > 0) tabBar.hide();
      }
    }
    const showBackToTop = scrollTop > (this.backToTopThreshold || 600);
    if (showBackToTop !== this.data.showBackToTop) this.setData({ showBackToTop });
    clearTimeout(this.supportTimer);
    if (!this.data.supportHidden) this.setData({ supportHidden: true });
    this.supportTimer = setTimeout(() => {
      this.setData({ supportHidden: false });
    }, 180);
  },

  scrollToTop(onScrolled) {
    this.createSelectorQuery()
      .select('#home-list')
      .node()
      .exec((result) => {
        const scrollView = result[0] && result[0].node;
        if (scrollView) scrollView.scrollTo({ top: 0, animated: false, duration: 0 });
        if (this.data.showBackToTop) this.setData({ showBackToTop: false });
        if (typeof onScrolled === 'function') onScrolled();
      });
  },

  async toggleFavorite(e) {
    if (!api.requireLogin()) return;
    const id = e.currentTarget.dataset.id;
    if (!(this.salons || []).some((item) => item.id === id)) return;
    try {
      await favoriteStore.toggle(id, !this.data.favorites.includes(id), (favorite) => this.applyFavorite(id, favorite));
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' });
    }
  },

  applyFavorite(id, favorite) {
    const favorites = this.data.favorites.filter((item) => item !== id);
    if (favorite) favorites.push(id);
    this.setData({ favorites });
    this.updateFavoriteCards();
  },

  openDetail(e) {
    const salonId = e.currentTarget.dataset.id;
    if (!salonId) return;
    analytics.track('salon_detail_click', { salonId });
    // 详情请求与页面切换同时进行，并把列表里已有的信息交给详情页先展示头部。
    salonDetail.prefetch(salonId, (this.salons || []).find((item) => item.id === salonId));
    wx.navigateTo({ url: `/pages/detail/detail?id=${salonId}` });
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

  // 选位置页只通过事件通道交回选中的地点，首页自己决定更新哪些字段、何时刷新列表。
  openLocation() {
    wx.navigateTo({
      url: `/pages/location/location?text=${encodeURIComponent(this.data.locationText)}&latitude=${this.data.latitude}&longitude=${this.data.longitude}`,
      events: {
        locationSelected: (location) => this.applySelectedLocation(location)
      }
    });
  },

  // 手动选点：以用户选择为准（不再被随后返回的模糊定位覆盖），首页回到前台时再按新位置加载列表。
  applySelectedLocation(location = {}) {
    const latitude = Number(location.latitude);
    const longitude = Number(location.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    this.setData({
      latitude,
      longitude,
      locationText: location.name || '已选位置',
      locatedOnce: true,
      locationIsFuzzy: false
    });
    this.locationChanged = true;
  }
});

function readLastLocation() {
  const stored = wx.getStorageSync(LAST_LOCATION_KEY);
  const latitude = stored && stored.latitude;
  const longitude = stored && stored.longitude;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function distanceMeters(from, to) {
  const toRadians = (degrees) => degrees * Math.PI / 180;
  const x = toRadians(to.longitude - from.longitude) * Math.cos(toRadians((from.latitude + to.latitude) / 2));
  const y = toRadians(to.latitude - from.latitude);
  return Math.sqrt(x * x + y * y) * 6371000;
}
