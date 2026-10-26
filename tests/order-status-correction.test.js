const assert = require('node:assert/strict');
const test = require('node:test');
global.getApp = () => ({ globalData: {} });
const { formatOrderDetail, formatMessage } = require('../utils/orders');

for (const [status, reason] of [['canceled', '用户要求取消'], ['no_show', '用户未到店']]) {
  test(`existing order and message consumers display corrected completion as ${status}`, () => {
    const booking = {
      id: 'corrected-order', status, rejectReason: reason,
      startTime: '2026-10-20T10:00:00+08:00', createdAt: '2026-10-19T10:00:00+08:00',
      servicePriceFen: 8000, originalAmountFen: 8000, payableAmountFen: 8000,
      couponId: '', couponDiscountFen: 0,
      userMessage: status === 'no_show' ? '商家已将本次预约标记为爽约。' : '商家已取消本次预约：用户要求取消',
    };
    const detail = formatOrderDetail(booking);
    assert.equal(detail.reasonText, reason);
    assert.equal(detail.hasCouponDiscount, false);
    assert.equal(detail.payableAmountText, '¥80');
    assert.equal(detail.canReview, false);
    assert.equal(detail.canComplain, false);
    assert.equal(detail.canCancel, false);
    const message = formatMessage(booking);
    assert.equal(message.statusLabel, status === 'no_show' ? '未到店' : '已取消');
  });
}
