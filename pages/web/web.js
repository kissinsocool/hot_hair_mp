const { normalizeHttpsUrl } = require('../../utils/webUrl');

Page({
  data: { url: '' },

  onLoad(options = {}) {
    let decoded = '';
    try {
      decoded = decodeURIComponent(options.url || '');
    } catch (_) {
      // Invalid percent encoding is handled as an invalid URL below.
    }
    const url = normalizeHttpsUrl(decoded);
    if (!url) {
      wx.showToast({ title: '页面链接无效', icon: 'none' });
      return;
    }
    this.setData({ url });
  }
});
