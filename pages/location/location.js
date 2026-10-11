Page({
  data: {
    locating: false,
    address: '',
    addressText: '可使用微信地图选择位置',
    latitude: 0,
    longitude: 0,
    manual: ''
  },

  onLoad(options) {
    this.setData({
      addressText: options.text ? decodeURIComponent(options.text) : this.data.addressText,
      latitude: Number(options.latitude) || 0,
      longitude: Number(options.longitude) || 0
    });
  },

  locate() {
    this.setData({ locating: true });
    wx.chooseLocation({
      latitude: this.data.latitude,
      longitude: this.data.longitude,
      success: (res) => {
        const pages = getCurrentPages();
        const prev = pages[pages.length - 2];
        if (prev) {
          prev.setData({
            latitude: res.latitude,
            longitude: res.longitude,
            locationText: res.name || res.address || '已选位置',
            locatedOnce: true,
            locationIsFuzzy: false
          });
          if (prev.loadSalons) prev.loadSalons();
        }
        wx.navigateBack();
      },
      fail: () => wx.showToast({ title: '定位失败', icon: 'none' }),
      complete: () => this.setData({ locating: false })
    });
  },

  onManual(e) {
    this.setData({ manual: e.detail.value });
  },

  useManual() {
    const pages = getCurrentPages();
    const prev = pages[pages.length - 2];
    if (prev) prev.setData({ locationText: this.data.manual || '手动选择位置' });
    wx.navigateBack();
  }
});
