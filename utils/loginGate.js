const api = require('./api');

// 必须登录才能使用的非 tab 页面，在 onShow 里调用 ensure(this)，返回 true 才继续加载。
// 页面每次显示时可能处于三种状态：
// 1. 已登录：返回 true。
// 2. 未登录，还没有为本页打开过登录页：打开登录页，返回 false；登录成功返回本页时回到状态 1。
// 3. 未登录，已经为本页打开过登录页（由本函数、api.requireLogin 或请求返回 401 时打开）：
//    用户没有登录就返回了，离开本页，不再把用户推回登录页。本页是页面栈里唯一的页面时回到首页
//    （例如从微信服务通知直接进入）。
function ensure(page) {
  const session = api.session();
  if (session && session.token) {
    page.loginRequested = false;
    return true;
  }
  if (page.loginRequested) {
    page.loginRequested = false;
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/home/home' }) });
    return false;
  }
  page.loginRequested = true;
  api.requireLogin();
  return false;
}

module.exports = { ensure };
