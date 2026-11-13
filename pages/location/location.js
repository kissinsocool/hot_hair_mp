const { onShareAppMessage } = require('../../utils/share');
Page({
  onShareAppMessage,

  data: {
    locating: false,
    addressText: '可使用微信地图选择位置',
    latitude: 0,
    longitude: 0
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
        // 只把选中的地点交给打开本页的页面，不直接修改对方的数据。
        const channel = this.getOpenerEventChannel && this.getOpenerEventChannel();
        if (channel && channel.emit) {
          channel.emit('locationSelected', {
            latitude: res.latitude,
            longitude: res.longitude,
            name: res.name || res.address || ''
          });
        }
        wx.navigateBack();
      },
      fail: () => wx.showToast({ title: '定位失败', icon: 'none' }),
      complete: () => this.setData({ locating: false })
    });
  }
});
