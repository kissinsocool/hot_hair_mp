App({
  globalData: {
    apiBaseUrl: 'http://192.168.1.11:3000/api'
  },

  onLaunch() {
    const session = wx.getStorageSync('session');
    if (session && session.token) this.globalData.session = session;
  }
});
