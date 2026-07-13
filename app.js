App({
  globalData: {
    apiBaseUrl: 'http://182.92.129.180:3000/api'
  },

  onLaunch() {
    const session = wx.getStorageSync('session');
    if (session && session.token) this.globalData.session = session;
  }
});
