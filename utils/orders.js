const api = require('./api');

function displayStaffName(order) {
  return order.isNoPreference || (order.candidateStaffIds && order.candidateStaffIds.length) ? '无需指定' : order.staffName;
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

function formatOrder(order) {
  const date = new Date(order.startTime);
  const startTimeText = api.formatTime(order.startTime);
  return {
    ...order,
    orderNo: order.orderNo || order.id,
    staffName: displayStaffName(order),
    statusLabel: order.statusLabel || api.statusText(order.status),
    statusClass: statusClass(order.status),
    startTimeMs: Number.isNaN(date.getTime()) ? 0 : date.getTime(),
    startTimeText,
    canCancel: ['pending', 'accepted'].includes(order.status),
    canReview: order.status === 'completed',
    canComplain: order.status === 'completed',
    reviewButtonText: order.reviewed ? '已评价' : '评价晒单',
    complaintButtonText: order.complained ? '已投诉' : '投诉',
    reviewButtonClass: order.reviewed ? ' disabled-btn' : '',
    complaintButtonClass: order.complained ? ' disabled-btn' : ''
  };
}

function formatMessage(order) {
  return {
    ...order,
    staffName: displayStaffName(order),
    statusLabel: messageStatus(order.status, order.statusLabel),
    userMessageText: order.userMessage || messageText(order.status),
    startTimeText: api.formatTime(order.startTime)
  };
}

module.exports = {
  formatMessage,
  formatOrder
};
