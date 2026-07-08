const api = require('../../utils/api');

Page({
  data: {
    agreed: false,
    loading: false
  },

  toggleAgreement() {
    this.setData({ agreed: !this.data.agreed });
  },

  async loginByPhone(e) {
    if (!this.data.agreed) {
      wx.showToast({ title: '请阅读并勾选用户协议', icon: 'none' });
      return;
    }

    const detail = e.detail || {};
    if (detail.errMsg && !/ok/i.test(detail.errMsg)) {
      console.warn('getPhoneNumber failed:', detail);
      wx.showToast({ title: detail.errMsg.includes('deny') ? '请在微信弹窗中允许手机号授权' : '手机号授权失败', icon: 'none' });
      return;
    }

    this.setData({ loading: true });
    try {
      if (!detail.code && (!detail.encryptedData || !detail.iv)) {
        console.warn('getPhoneNumber missing phone payload:', detail);
        throw new Error('未获取到微信手机号授权结果');
      }
      const data = detail.code
        ? { code: detail.code }
        : {
            encryptedData: detail.encryptedData,
            iv: detail.iv,
            loginCode: await this.wxLogin()
          };
      const session = await api.request('/auth/wechat/phone', {
        method: 'POST',
        data
      });
      api.saveSession(session);
      wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/home/home' }) });
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  wxLogin() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: (res) => res.code ? resolve(res.code) : reject(new Error('微信登录失败')),
        fail: () => reject(new Error('微信登录失败'))
      });
    });
  }
});
