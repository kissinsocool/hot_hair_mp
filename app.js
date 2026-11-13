const logger = require('./utils/logger');
const appUpdate = require('./utils/appUpdate');
const networkStatus = require('./utils/networkStatus');

App({
  globalData: {
    apiBaseUrl: 'https://api.hothaircc.cn/api',
    mediaBaseUrl: 'https://media.hothaircc.cn',
    pendingLoginReturnRoute: ''
  },

  onLaunch() {
    const session = wx.getStorageSync('session');
    this.globalData.session = session && session.token ? session : null;
    // 本地会话只在启动时读取一次；之后登录、退出都会同步更新 globalData。
    this.globalData.sessionLoaded = true;
    appUpdate.watchForUpdate();
    networkStatus.watch();
  },

  // 未捕获的脚本错误和 Promise 拒绝写入实时日志，线上问题才有据可查。
  onError(message) {
    logger.error('[app] script error', logger.describe(message));
  },

  onUnhandledRejection({ reason } = {}) {
    logger.error('[app] unhandled rejection', logger.describe(reason));
  }
});
