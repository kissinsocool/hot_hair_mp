App({
  globalData: {
    apiBaseUrl: 'https://api.hothaircc.cn/api',
    mediaBaseUrl: 'https://media.hothaircc.cn',
    pendingLoginReturnRoute: ''
  },

  onLaunch() {
    const session = wx.getStorageSync('session');
    if (session && session.token) this.globalData.session = session;
  }
});
