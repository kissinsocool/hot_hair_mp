const test = require('node:test');
const assert = require('node:assert/strict');
global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api' } });
const { formatOrder, formatOrderDetail } = require('../utils/orders');
const base = { id: 'B1', status: 'completed', startTime: '2030-01-01T10:00:00+08:00' };

test('order cards use the confirmed reservation wording and Hot Pepper date hierarchy', () => {
  const accepted = formatOrder({ ...base, status: 'accepted' });
  assert.equal(accepted.cardStatusLabel, '预约成功');
  assert.equal(accepted.cardStartTimeText, '2030年1月1日 10:00');
  assert.equal(formatOrder({ ...base, status: 'pending' }).cardStatusLabel, '等待确认');
  assert.equal(formatOrder(base).cardStatusLabel, '已到店');
});

test('completion source does not change user status, review or feedback availability', () => {
  for (const completionSource of ['automatic', 'merchant', undefined]) {
    const detail = formatOrderDetail({ ...base, completionSource });
    assert.equal(detail.statusLabel, '已完成');
    assert.equal(detail.canReview, true);
    assert.equal(detail.canReportIssue, true);
  }
  assert.equal(formatOrderDetail({ ...base, status: 'canceled', completionSource: 'automatic' }).canReview, false);
});

test('feedback keeps processing state separate from content moderation and shows the saved response', () => {
  const complaint = { reason: 'not_arrived', reviewStatus: 'approved', description: '没有到店' };
  const pending = formatOrderDetail({ ...base, complaint });
  assert.equal(pending.complaint.statusText, '待平台处理');
  assert.equal(pending.complaint.reasonText, '未到店');
  assert.equal(pending.canReportIssue, false);
  const handled = formatOrderDetail({ ...base, complaint: { ...complaint, status: 'handled', response: '已核实情况', handledAt: '2030-01-02T10:00:00+08:00' } });
  assert.equal(handled.complaint.statusText, '已处理');
  assert.equal(handled.complaint.response, '已核实情况');
  assert.ok(handled.complaint.handledTimeText);
});

test('message opens the referenced order and feedback returns to the existing complaint editor', () => {
  let definition;
  let navigated;
  let initialized;
  global.Page = page => { definition = page; };
  global.wx = { navigateTo(options) {
    navigated = options.url;
    options.success?.({ eventChannel: { emit(event, value) { initialized = { event, value }; } } });
  } };
  try {
    require('../pages/messages/messages');
    definition.openOrder({ currentTarget: { dataset: { id: 'B1' } } });
    assert.equal(navigated, '/pages/order-detail/order-detail?id=B1');
    require('../pages/order-detail/order-detail');
    const order = formatOrderDetail(base);
    definition.reportIssue.call({ data: { order } });
    assert.equal(navigated, '/pages/review-editor/review-editor');
    assert.equal(initialized.event, 'init');
    assert.equal(initialized.value.mode, 'complaint');
    assert.equal(initialized.value.booking.id, 'B1');
  } finally { delete global.Page; delete global.wx; }
});
