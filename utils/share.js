const { promotionCategory } = require('./promotionCategories');

const HOME_PATH = '/pages/home/home';
const PUBLIC_PAGE_PARAMS = {
  'pages/detail/detail': ['id'],
  'pages/staff/staff': ['id', 'salonId'],
  'pages/salon-posts/salon-posts': ['salonId'],
  'pages/salon-reviews/salon-reviews': ['salonId'],
  'pages/style-gallery/style-gallery': ['category']
};

function onShareAppMessage() {
  const data = this.data || {};
  const params = PUBLIC_PAGE_PARAMS[this.route];
  const category = promotionCategory(data.category);
  let title = '放心预约安心享受｜美发专属预约平台';
  let path = HOME_PATH;

  // 只分享公开内容的必要参数，不带出订单、登录状态或用户位置。
  if (params && params.every((key) => data[key]) &&
      (this.route !== 'pages/style-gallery/style-gallery' || category)) {
    path = `/${this.route}?${params.map((key) => `${key}=${encodeURIComponent(data[key])}`).join('&')}`;
  }

  if (this.route === 'pages/home/home') {
    title = '放心预约、安心享受｜美发预约';
    return { title, path, imageUrl: '/assets/images/home-share.jpg' };
  }
  let imageUrl = '/assets/images/auth_hero.jpg';
  if (path !== HOME_PATH) {
    if (this.route === 'pages/detail/detail' && data.salon) {
      title = data.salon.name
        ? `${data.salon.name}${data.salon.description ? ` 「${data.salon.description}」` : ''}`
        : title;
      imageUrl = data.salon.image || imageUrl;
    } else if (this.route === 'pages/staff/staff' && data.staff) {
      title = [data.salonName, data.staff.name].filter(Boolean).join('  ') || title;
      imageUrl = data.staff.imageUrl || imageUrl;
    }
  }
  return { title, path, imageUrl };
}

module.exports = { onShareAppMessage };
