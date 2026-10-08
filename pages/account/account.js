const api = require('../../utils/api');
const MAX_IMAGE_BYTES = 800 * 1024;

Page({
  data: {
    displayName: '',
    gender: '保密',
    genderIndex: 0,
    genders: ['保密', '女', '男', '其他'],
    avatarUrl: '',
    avatarPreview: '',
    avatarReviewStatus: 'none',
    avatarRejectReason: '',
    pendingAvatar: null,
    saving: false
  },

  onLoad() {
    const session = api.session();
    if (!session || !session.token) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
    this.applyUser(session.user || {});
    this.refreshUser();
  },

  applyUser(user) {
    const gender = user.gender || '保密';
    this.setData({
      displayName: user.displayName || '',
      gender,
      genderIndex: Math.max(0, this.data.genders.indexOf(gender)),
      avatarUrl: user.avatarUrl || '',
      avatarPreview: api.userAvatarUrl(user),
      avatarReviewStatus: user.avatarReviewStatus || 'none',
      avatarRejectReason: user.avatarRejectReason || ''
    });
  },

  async refreshUser() {
    try {
      const response = await api.request('/auth/me');
      const current = api.session();
      if (!current || !response.user) return;
      const session = { ...current, user: response.user };
      api.saveSession(session);
      this.applyUser(session.user);
    } catch (_) {}
  },

  onName(e) { this.setData({ displayName: e.detail.value }); },
  onGender(e) {
    const genderIndex = Number(e.detail.value);
    this.setData({ genderIndex, gender: this.data.genders[genderIndex] });
  },

  pickAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      success: async (res) => {
        const file = res.tempFiles && res.tempFiles[0];
        if (!file) return;
        const tempPath = await compressImage(file.tempFilePath);
        const size = wx.getFileSystemManager().statSync(tempPath).size;
        if (!size || size > MAX_IMAGE_BYTES) {
          wx.showToast({ title: '图片过大，请换一张', icon: 'none' });
          return;
        }
        const fileName = tempPath.split('/').pop() || 'avatar.jpg';
        this.setData({
          avatarPreview: tempPath,
          pendingAvatar: { tempPath, size, fileName, contentType: imageContentType(fileName) }
        });
      }
    });
  },

  async save() {
    const displayName = this.data.displayName.trim();
    if (!displayName) return wx.showToast({ title: '请输入昵称', icon: 'none' });

    this.setData({ saving: true });
    try {
      const avatarUrl = this.data.pendingAvatar
        ? await uploadAvatar(this.data.pendingAvatar)
        : this.data.avatarUrl;
      const session = await api.request('/auth/profile', {
        method: 'PATCH',
        data: { displayName, gender: this.data.gender, avatarUrl }
      });
      if (this.data.pendingAvatar && session.user.avatarReviewStatus === 'pending') {
        try {
          await api.savePendingAvatarPreview(this.data.pendingAvatar.tempPath, session.user);
        } catch (_) {
          api.clearPendingAvatarPreview();
        }
      }
      api.saveSession(session);
      this.applyUser(session.user || {});
      this.setData({ pendingAvatar: null });
      wx.showToast({ title: session.user.avatarReviewStatus === 'pending' ? '头像审核中' : '资料已保存' });
      setTimeout(() => wx.navigateBack(), 500);
    } catch (err) {
      wx.showToast({ title: err.message || '保存失败，请稍后再试', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      success: (result) => {
        if (!result.confirm) return;
        api.clearSession();
        wx.reLaunch({ url: '/pages/login/login' });
      }
    });
  }
});

function compressImage(src) {
  return new Promise((resolve) => {
    if (!wx.compressImage) return resolve(src);
    wx.compressImage({ src, quality: 60, success: (res) => resolve(res.tempFilePath || src), fail: () => resolve(src) });
  });
}

function imageContentType(fileName) {
  const name = String(fileName || '').toLowerCase();
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

async function uploadAvatar(image) {
  const { upload } = await api.request('/uploads/avatar/sign', {
    method: 'POST',
    data: { files: [{ fileName: image.fileName, contentType: image.contentType, size: image.size }] }
  });
  if (!upload) throw new Error('头像上传凭证获取失败');
  await api.uploadFile(upload.uploadUrl, image.tempPath, upload.fields);
  return upload.url;
}
