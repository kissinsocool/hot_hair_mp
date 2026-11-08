const layout = require('../../utils/layout');

// 在模块加载时就算好尺寸，让首次渲染即为最终高度，避免头部先错位再跳动。
function initialSize() {
  try {
    return layout.appBarSize();
  } catch (_) {
    return { statusBarHeight: 0, navBarHeight: 44, appBarHeight: 44 };
  }
}

const size = initialSize();

// tab 页统一使用的自定义深色头部；所有 tab 页都不使用原生导航栏，
// 切换 tab 时就不会因为原生导航栏的显示/隐藏而整页闪动。
Component({
  options: {
    multipleSlots: false
  },

  properties: {
    title: { type: String, value: '' }
  },

  data: {
    statusBarHeight: size.statusBarHeight,
    appBarHeight: size.appBarHeight
  }
});
