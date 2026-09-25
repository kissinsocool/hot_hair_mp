function appBarSize(extraHeight = 0) {
  const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
  const windowWidth = info.windowWidth || 375;
  const statusBarHeight = info.statusBarHeight || 0;
  const menu = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null;
  const navBarHeight = menu && menu.height
    ? menu.height + (menu.top - statusBarHeight) * 2
    : 44;
  const menuButtonOffset = menu && menu.width
    ? windowWidth - menu.left
    : 97 * (windowWidth / 375);

  return {
    statusBarHeight,
    navBarHeight,
    appBarHeight: Math.ceil(statusBarHeight + navBarHeight + extraHeight),
    menuButtonOffset
  };
}

module.exports = { appBarSize };
