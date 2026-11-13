const api = require('./api');
const { postServiceView } = require('./postService');

function formatPostDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// 店铺动态卡片（全部动态页、收藏页“套餐”分类）共用的展示数据。
// services 的含义同 postServiceView：null 表示套餐列表没取到。
async function postCardView(post, services) {
  return {
    id: post.id,
    salonId: post.salonId || '',
    salonName: post.salonName || '',
    content: post.content || '',
    authorName: post.authorName || '',
    authorStaffId: post.authorStaffId || '',
    ...postServiceView(post, services),
    imageUrls: await Promise.all((post.imageUrls || []).map((image) => api.displayImageUrl(image, 480, { webp: true }))),
    dateText: formatPostDate(post.createdAt)
  };
}

module.exports = { postCardView, formatPostDate };
