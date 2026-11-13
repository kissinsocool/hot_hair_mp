const { onShareAppMessage } = require('../../utils/share');
const api = require('../../utils/api');
const { buildReviewTags, selectedReviewTags, toggleReviewTag } = require('./reviewTags.js');
const { reviewRatingAverage } = require('../../utils/reviewRatings.js');
const { shrinkImage } = require('./reviewImages.js');

Page({
  onShareAppMessage,

  data: {
    ready: false,
    mode: 'review',
    bookingId: '',
    salonName: '',
    serviceName: '',
    ratings: {},
    tags: buildReviewTags(),
    content: '',
    reason: 'other',
    noShowDispute: false,
    issueReasons: [
      { value: 'not_arrived', label: '未到店' },
      { value: 'service_incomplete', label: '服务未完成' },
      { value: 'other', label: '其他问题' }
    ],
    images: [],
    submitting: false,
    submitted: false
  },

  onLoad() {
    if (!api.requireLogin()) return;
    this.getOpenerEventChannel().on('init', ({ mode, booking }) => {
      if (!booking || !['review', 'edit', 'complaint'].includes(mode)) return;
      const editing = mode === 'edit';
      const noShowDispute = mode === 'complaint' && booking.status === 'no_show';
      const bookingId = editing ? booking.bookingId : booking.id;
      if (!bookingId) return;
      const imageKeys = booking.imageKeys || [];
      this.setData({
        ready: true,
        mode,
        bookingId,
        noShowDispute,
        reason: noShowDispute ? 'no_show_dispute' : 'other',
        salonName: booking.salonName || '',
        serviceName: booking.serviceName || '',
        ratings: editing ? { ...booking.ratings } : {},
        tags: buildReviewTags(editing ? booking.tags : []),
        content: editing ? booking.comment || '' : '',
        images: editing ? (booking.imageUrls || []).map((tempPath, index) => ({
          tempPath, retainedUrl: imageKeys[index] || tempPath, existing: true
        })) : []
      });
      const title = { edit: '编辑评价', complaint: noShowDispute ? '未到店异议' : '投诉', review: '评价晒单' };
      wx.setNavigationBarTitle({ title: title[mode] });
    });
  },

  chooseRating(e) {
    const { key, value } = e.detail;
    this.setData({ ratings: { ...this.data.ratings, [key]: value } });
  },

  chooseReviewTag(e) {
    this.setData({ tags: toggleReviewTag(this.data.tags, e.currentTarget.dataset.name) });
  },

  chooseIssueReason(e) {
    this.setData({ reason: e.detail.value });
  },

  onContent(e) {
    this.setData({ content: e.detail.value });
  },

  pickImages() {
    const remain = 5 - this.data.images.length;
    if (remain <= 0 || this.data.submitting || this.data.submitted) return;
    wx.chooseMedia({
      count: remain,
      mediaType: ['image'],
      sizeType: ['compressed'],
      success: async (res) => {
        const additions = await prepareImages(res.tempFiles || []);
        this.setData({ images: this.data.images.concat(additions).slice(0, 5) });
      }
    });
  },

  removeImage(e) {
    if (this.data.submitting || this.data.submitted) return;
    const index = Number(e.currentTarget.dataset.index);
    this.setData({ images: this.data.images.filter((_, itemIndex) => itemIndex !== index) });
  },

  async submit() {
    if (!this.data.ready || this.data.submitting || this.data.submitted) return;
    const { mode, bookingId, ratings, tags, images } = this.data;
    const content = this.data.content.trim();
    const isReview = mode !== 'complaint';
    const rating = reviewRatingAverage(ratings);
    if (isReview && !rating) return wx.showToast({ title: '请为四项分别评分', icon: 'none' });
    if (!content) return wx.showToast({ title: isReview ? '请输入具体评价' : '请输入问题描述', icon: 'none' });
    this.setData({ submitting: true });
    try {
      const imageObjects = await uploadImages(images.filter(image => !image.existing), isReview ? 'review' : 'complaint');
      const data = isReview
        ? { rating, ratings, comment: content, tags: selectedReviewTags(tags), imageObjects }
        : { description: content, imageObjects, reason: this.data.reason };
      if (mode === 'edit') data.retainedImageUrls = images.filter(image => image.existing).map(image => image.retainedUrl);
      await api.request(`/bookings/${encodeURIComponent(bookingId)}/${isReview ? 'review' : 'complaint'}`, {
        method: mode === 'edit' ? 'PATCH' : 'POST', data
      });
      this.setData({ submitted: true });
      wx.navigateBack({ delta: 1 });
      const title = { edit: '评价修改已提交审核', review: '评价晒单已提交', complaint: this.data.noShowDispute ? '异议已提交' : '投诉已提交' };
      wx.showToast({ title: title[mode] });
    } catch (err) {
      wx.showToast({ title: err.message || '提交失败，请稍后重试', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  }
});

async function prepareImages(files) {
  const fs = wx.getFileSystemManager();
  const images = [];
  for (const file of files) {
    try {
      const shrunk = await shrinkImage(file.tempFilePath, fs);
      if (!shrunk) {
        wx.showToast({ title: '图片过大，请换一张', icon: 'none' });
        continue;
      }
      const fileName = shrunk.path.split('/').pop() || 'image.jpg';
      images.push({ tempPath: shrunk.path, fileName, contentType: imageContentType(fileName), size: shrunk.size, existing: false });
    } catch (_) {}
  }
  return images;
}

function imageContentType(fileName) {
  const name = String(fileName || '').toLowerCase();
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

async function uploadImages(images, type) {
  if (!images.length) return [];
  const { uploads = [] } = await api.request('/uploads/moderation/sign', {
    method: 'POST',
    data: { type, files: images.map(({ fileName, contentType, size }) => ({ fileName, contentType, size })) }
  });
  if (uploads.length !== images.length) throw new Error('图片上传凭证数量不正确');
  await Promise.all(uploads.map((upload, index) => api.uploadFile(upload.uploadUrl, images[index].tempPath, upload.fields)));
  return uploads.map((upload) => upload.objectName);
}
