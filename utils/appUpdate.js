const logger = require('./logger');

// 微信只在冷启动时后台下载新版本，下载完成前用户一直使用旧版本。
// 新版本就绪后提示用户重启：用户可以选择稍后（正在预约时不打断），下次冷启动会自动使用新版本。
// 这样能缩短线上旧客户端的存留时间，接口做「扩展—迁移—收缩」时可以更早移除旧兼容。
function watchForUpdate() {
  if (!wx.getUpdateManager) return;
  const manager = wx.getUpdateManager();
  manager.onUpdateReady(() => {
    wx.showModal({
      title: '发现新版本',
      content: '新版本已经准备好，重启小程序即可使用。',
      confirmText: '立即重启',
      cancelText: '稍后',
      success: ({ confirm }) => {
        if (confirm) manager.applyUpdate();
      }
    });
  });
  manager.onUpdateFailed(() => {
    logger.warn('[app] new version download failed');
  });
}

module.exports = { watchForUpdate };
