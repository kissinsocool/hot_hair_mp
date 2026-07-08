function appBarSize(extraHeight = 0) {
  const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
  const statusBarHeight = info.statusBarHeight || 0;
  const menu = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null;
  const navBarHeight = menu && menu.height
    ? menu.height + (menu.top - statusBarHeight) * 2
    : 44;

  return {
    statusBarHeight,
    navBarHeight,
    appBarHeight: Math.ceil(statusBarHeight + navBarHeight + extraHeight)
  };
}

module.exports = { appBarSize };
