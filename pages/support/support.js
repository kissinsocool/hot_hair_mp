const api = require('../../utils/api');

Page({
  data: {
    problem: '',
    contact: '',
    submitting: false
  },

  onProblem(e) {
    this.setData({ problem: e.detail.value });
  },

  onContact(e) {
    this.setData({ contact: e.detail.value });
  },

  async submit() {
    if (this.data.submitting) return;
    if (!this.data.problem.trim()) {
      wx.showToast({ title: '请描述您遇到的问题', icon: 'none' });
      return;
    }
    if (!this.data.contact.trim()) {
      wx.showToast({ title: '请输入联系方式', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      await api.request('/support-messages', {
        method: 'POST',
        data: {
          problem: this.data.problem.trim(),
          contact: this.data.contact.trim()
        }
      });
      wx.showToast({ title: '反馈已提交' });
      this.setData({ problem: '', contact: '' });
    } catch (error) {
      wx.showToast({ title: error.message || '提交失败，请稍后重试', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
