const api = require('./api');
const { formatFen } = require('./money');

function displayStaffName(order) {
  return order.isNoPreference || !order.staffId ? '无需指定' : order.staffName;
}

function statusClass(status) {
  if (status === 'completed' || status === 'accepted') return 'status-green';
  if (status === 'rejected') return 'status-red';
  return 'status-orange';
}

function messageStatus(status, fallback) {
  return {
    pending: '等待商家确认',
    accepted: '等待到店',
    rejected: '预约未通过',
    canceled: '已取消',
    cancelled: '已取消',
    completed: '已完成',
    no_show: '未到店'
  }[status] || fallback || api.statusText(status);
}

function messageText(status) {
  if (status === 'completed') return '本次预约已完成，感谢到店。';
  if (status === 'rejected') return '预约未通过，请重新选择时间。';
  if (status === 'canceled' || status === 'cancelled') return '预约已取消。';
  return '预约申请已提交，正在等待商家确认。';
}

function couponDisplay(order) {
  const discountFen = Math.max(0, Number(order.couponDiscountFen || 0));
  return {
    hasCouponDiscount: discountFen > 0,
    couponText: `${order.couponTitle || '优惠券'}，优惠 ${formatFen(discountFen)}`
  };
}

function cardStatusLabel(status, fallback) {
  return {
    pending: '等待确认',
    accepted: '预约成功',
    rejected: '预约未通过',
    canceled: '已取消',
    cancelled: '已取消',
    completed: '已到店',
    no_show: '未到店'
  }[status] || fallback || api.statusText(status);
}

function cardStartTime(value) {
  const text = api.formatTime(value);
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2})$/.exec(text);
  return match ? `${match[1]}年${Number(match[2])}月${Number(match[3])}日 ${match[4]}` : text;
}

function formatOrder(order) {
  const date = new Date(order.startTime);
  const startTimeText = api.formatTime(order.startTime);
  const createdTimeText = api.formatTime(order.createdAt || order.createTime || order.createdTime);
  return {
    ...order,
    orderNo: order.orderNo || order.id,
    salonImageUrl: order.salonImageUrl ? api.thumbnailUrl(order.salonImageUrl, 360) : '',
    staffName: displayStaffName(order),
    statusLabel: order.statusLabel || api.statusText(order.status),
    cardStatusLabel: cardStatusLabel(order.status, order.statusLabel),
    statusClass: statusClass(order.status),
    startTimeMs: Number.isNaN(date.getTime()) ? 0 : date.getTime(),
    startTimeText,
    cardStartTimeText: cardStartTime(order.startTime),
    createdTimeText,
    ...couponDisplay(order),
    canCancel: ['pending', 'accepted'].includes(order.status),
    canReview: order.status === 'completed',
    canComplain: order.status === 'completed',
    canRebook: order.status === 'completed',
    reviewButtonText: order.reviewed ? '已评价' : '评价晒单',
    complaintButtonText: order.complained ? '已投诉' : '投诉',
    reviewButtonClass: order.reviewed ? ' disabled-btn' : '',
    complaintButtonClass: order.complained ? ' disabled-btn' : ''
  };
}

function formatOrderDetail(order) {
  const formatted = formatOrder(order);
  const servicePriceFen = nonNegativeFen(order.servicePriceFen);
  const staffExtraServiceFeeFen = nonNegativeFen(order.staffExtraServiceFeeFen);
  const couponDiscountFen = nonNegativeFen(order.couponDiscountFen);
  const originalAmountFen = Number.isSafeInteger(order.originalAmountFen)
    ? order.originalAmountFen
    : servicePriceFen + staffExtraServiceFeeFen;
  const payableAmountFen = Number.isSafeInteger(order.payableAmountFen)
    ? order.payableAmountFen
    : Math.max(0, originalAmountFen - couponDiscountFen);
  const complaint = order.complaint || null;
  return {
    ...formatted,
    servicePriceText: formatFen(servicePriceFen),
    staffExtraServiceFeeText: formatFen(staffExtraServiceFeeFen),
    originalAmountText: formatFen(originalAmountFen),
    couponDiscountText: `- ${formatFen(couponDiscountFen)}`,
    payableAmountText: formatFen(payableAmountFen),
    hasStaffExtraServiceFee: staffExtraServiceFeeFen > 0,
    reasonTitle: order.status === 'rejected' ? '拒绝原因' : order.status === 'no_show' ? '爽约说明' : '取消原因',
    reasonText: ['rejected', 'canceled', 'cancelled', 'no_show'].includes(order.status)
      ? order.rejectReason || ''
      : '',
    canReportIssue: order.status === 'completed' && !order.complained && !complaint,
    complaint: complaint && {
      ...complaint,
      reasonText: { not_arrived: '未到店', service_incomplete: '服务未完成', other: '其他问题' }[complaint.reason] || '其他问题',
      response: complaint.response || '',
      handledTimeText: complaint.handledAt ? api.formatTime(complaint.handledAt) : '',
      statusText: complaint.status === 'handled' ? '已处理' : '待平台处理',
      createdTimeText: api.formatTime(complaint.createdAt)
    }
  };
}

function nonNegativeFen(value) {
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : 0;
}

function formatMessage(order) {
  return {
    ...order,
    ...couponDisplay(order),
    staffName: displayStaffName(order),
    statusLabel: messageStatus(order.status, order.statusLabel),
    userMessageText: order.userMessage || messageText(order.status),
    startTimeText: api.formatTime(order.startTime)
  };
}

module.exports = {
  formatMessage,
  formatOrder,
  formatOrderDetail
};
