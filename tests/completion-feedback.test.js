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

test('no-show orders accept one dispute and display the platform decision', () => {
  const order = { ...base, status: 'no_show', statusLabel: '爽约' };
  assert.equal(formatOrderDetail(order).canReportIssue, true);
  const complaint = { reason: 'no_show_dispute', description: '我已到店' };
  assert.equal(formatOrderDetail({ ...order, complaint }).canReportIssue, false);
  const resolved = formatOrderDetail({ ...order, complaint: { ...complaint, status: 'handled', decision: 'approved' } });
  assert.equal(resolved.statusLabel, '爽约已撤销');
  assert.equal(resolved.cardStatusLabel, '爽约已撤销');
  assert.equal(resolved.complaint.statusText, '爽约已撤销');
  assert.equal(resolved.complaint.reasonText, '对未到店判定有异议');
  assert.equal(resolved.canReview, false);
});

test('the existing feedback editor submits a no-show dispute with its fixed reason', async () => {
  const api = require('../utils/api');
  const { requireLogin, request } = api;
  let definition;
  let submitted;
  global.Page = page => { definition = page; };
  global.wx = { setNavigationBarTitle() {}, navigateBack() {}, showToast() {} };
  api.requireLogin = () => true;
  api.request = async (path, options) => { submitted = { path, ...options }; };
  try {
    require('../pages/review-editor/review-editor');
    const page = {
      ...definition,
      data: { ...definition.data },
      getOpenerEventChannel() {
        return { on: (_, init) => init({ mode: 'complaint', booking: { ...base, status: 'no_show' } }) };
      },
      setData(patch) { Object.assign(this.data, patch); }
    };
    page.onLoad();
    page.onContent({ detail: { value: '我已到店，请核实' } });
    await page.submit();
    assert.deepEqual(submitted, {
      path: '/bookings/B1/complaint',
      method: 'POST',
      data: { reason: 'no_show_dispute', description: '我已到店，请核实', imageObjects: [] }
    });
  } finally {
    api.requireLogin = requireLogin;
    api.request = request;
    delete global.Page;
    delete global.wx;
  }
});
