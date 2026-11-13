const { serviceTagLabels } = require('./serviceTags');

// 店铺动态只带 serviceId，套餐的价格、标签和说明以店铺详情里的当前套餐为准。
// services 为 null 表示套餐列表没取到：此时无法判断套餐是否还在售，只展示名称。
function postServiceView(post, services) {
  const service = post.serviceId && services ? services.find((item) => item.id === post.serviceId) : null;
  return {
    serviceName: post.serviceName || '',
    serviceUnavailable: Boolean(post.serviceId && services && !service),
    relatedService: service ? {
      id: service.id,
      name: service.name,
      tags: serviceTagLabels(service.tagIds),
      noteText: String(service.note || service.description || '').trim().replace(/\s*[\r\n]+\s*/g, '，'),
      priceFen: service.priceFen,
      discountTenths: service.discountTenths,
      originalPriceFen: service.originalPriceFen
    } : null
  };
}

module.exports = { postServiceView };
