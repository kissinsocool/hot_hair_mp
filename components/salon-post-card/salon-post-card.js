const api = require('../../utils/api');
const navigation = require('../../utils/navigation');
const imageFallback = require('../../utils/imageFallback');

// 店铺动态卡片：店铺详情、全部动态和收藏页共用。收藏状态由页面维护，
// 点击收藏按钮只抛出 favoritechange 事件，由页面调用收藏接口并更新状态。
Component({
  properties: {
    post: { type: Object, value: {} },
    favorite: { type: Boolean, value: false },
    compact: { type: Boolean, value: false },
    showSalon: { type: Boolean, value: false }
  },

  methods: {
    toggleFavorite() {
      const { post, favorite } = this.data;
      if (!post || !post.id) return;
      this.triggerEvent('favoritechange', { id: post.id, favorite: !favorite });
    },

    // WebP 缩略图加载失败时换回 JPEG（post 是属性，组件内可按路径更新）。
    onImageError(e) {
      imageFallback.retryAsJpeg(this, e);
    },

    previewImage(e) {
      const post = this.data.post || {};
      api.previewImage({ urls: post.imageUrls || [], current: e.currentTarget.dataset.url });
    },

    openStaff(e) {
      const id = e.currentTarget.dataset.id;
      const salonId = (this.data.post && this.data.post.salonId) || '';
      if (!id) return;
      navigation.navigateTo(`/pages/staff/staff?id=${encodeURIComponent(id)}&salonId=${encodeURIComponent(salonId)}`);
    },

    openSalon() {
      const salonId = this.data.post && this.data.post.salonId;
      if (!salonId) return;
      navigation.navigateTo(`/pages/detail/detail?id=${encodeURIComponent(salonId)}`);
    }
  }
});
