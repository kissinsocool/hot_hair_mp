// 网络状态：断网时统一提示一次（不必依赖各页面请求失败时各自弹出的提示），
// 恢复后立即重连预约推送，并让当前页面重新加载之前失败的内容。
// 页面实现 onNetworkRestored() 即可在网络恢复时收到通知。
// 本模块在 App 启动时注册，依赖 getApp 的模块在回调里再引入。
let online = true;
let watching = false;

function currentPage() {
  const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
  return pages[pages.length - 1] || null;
}

function handleChange({ isConnected }) {
  const connected = isConnected !== false;
  if (connected === online) return;
  online = connected;
  if (!connected) {
    wx.showToast({ title: '网络已断开，请检查网络设置', icon: 'none', duration: 3000 });
    return;
  }
  require('./bookingSocket').resume();
  const page = currentPage();
  if (page && typeof page.onNetworkRestored === 'function') page.onNetworkRestored();
}

function watch() {
  if (watching || !wx.onNetworkStatusChange) return;
  watching = true;
  if (wx.getNetworkType) {
    wx.getNetworkType({ success: ({ networkType }) => { online = networkType !== 'none'; } });
  }
  wx.onNetworkStatusChange(handleChange);
}

function isOnline() {
  return online;
}

module.exports = { watch, isOnline };
