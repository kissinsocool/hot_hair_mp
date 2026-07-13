const api = require('../../utils/api');
const MAX_IMAGE_BASE64_LENGTH = Math.ceil(800 * 1024 * 4 / 3);

Page({
  data: {
    loggedIn: false,
    account: '',
    displayName: '',
    phone: '',
    gender: '保密',
    genderIndex: 0,
    genders: ['保密', '女', '男'],
    avatarUrl: '',
    avatarPreview: '',
    saving: false
  },

  onShow() {
    this.sync();
  },

  sync() {
    const session = api.session();
    if (!session || !session.token) {
      this.setData({ loggedIn: false });
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    const user = (session && session.user) || {};
    const genders = this.data.genders;
    this.setData({
      loggedIn: true,
      account: user.account || '',
      displayName: user.displayName || '',
      displayNameText: user.displayName || '未设置昵称',
      phone: user.phone || user.account || '',
      phoneText: user.phone || user.account || '',
      gender: user.gender || '保密',
      genderIndex: Math.max(0, genders.indexOf(user.gender || '保密')),
      avatarUrl: user.avatarUrl || '',
      avatarPreview: user.avatarUrl || ''
    });
  },

  onName(e) {
    this.setData({ displayName: e.detail.value });
  },

  onPhone(e) {
    this.setData({ phone: e.detail.value });
  },

  onGender(e) {
    const genderIndex = Number(e.detail.value);
    this.setData({ genderIndex, gender: this.data.genders[genderIndex] });
  },

  pickAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      success: async (res) => {
        const firstFile = res.tempFiles && res.tempFiles[0];
        const file = firstFile && firstFile.tempFilePath;
        if (!file) return;
        const tempPath = await compressImage(file);
        wx.getFileSystemManager().readFile({
          filePath: tempPath,
          encoding: 'base64',
          success: (read) => {
            if (read.data.length > MAX_IMAGE_BASE64_LENGTH) {
              wx.showToast({ title: '图片过大，请换一张', icon: 'none' });
              return;
            }
            const avatarUrl = `data:image/jpeg;base64,${read.data}`;
            this.setData({ avatarUrl, avatarPreview: tempPath });
          }
        });
      }
    });
  },

  async save() {
    const phone = this.data.phone.trim();
    if (!this.data.displayName.trim()) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }
    if (!/^1\d{10}$/.test(phone)) {
      wx.showToast({ title: '请输入有效手机号', icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    try {
      const session = await api.request('/auth/profile', {
        method: 'PATCH',
        data: {
          displayName: this.data.displayName.trim(),
          gender: this.data.gender,
          phone,
          avatarUrl: this.data.avatarUrl
        }
      });
      api.saveSession(session);
      this.sync();
      wx.showToast({ title: '资料已保存' });
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  },

  logout() {
    api.clearSession();
    this.sync();
  }
});

function compressImage(src) {
  return new Promise((resolve) => {
    if (!wx.compressImage) return resolve(src);
    wx.compressImage({
      src,
      quality: 35,
      success: (res) => resolve(res.tempFilePath || src),
      fail: () => resolve(src)
    });
  });
}
