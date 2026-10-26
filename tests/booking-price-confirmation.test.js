const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('a changed quote must be confirmed by a second submission; success binds actual amounts', async () => {
  let definition;
  let attempts = 0;
  let notice;
  const requests = [];
  const quote = { servicePriceFen: 8000, extraServiceFeeFen: 0, originalAmountFen: 8000, couponDiscountFen: 0, payableAmountFen: 8000 };
  const api = {
    formatTime: value => value,
    async request(_path, options) {
      requests.push(options.data); attempts++;
      if (attempts === 1) {
        const error = new Error('价格已更新');
        error.code = 'BOOKING_PRICE_CHANGED'; error.data = { quote };
        throw error;
      }
      return { booking: { ...quote, staffExtraServiceFeeFen: 0 } };
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../pages/confirm/confirm.js'), 'utf8'), {
    Page: value => { definition = value; }, require: name => name.endsWith('/api') ? api : name.endsWith('/money') ? { formatFen: amount => `¥${amount / 100}` } : {},
    wx: { showModal(value) { notice = value; }, showToast() {} },
  });
  const page = { ...definition, data: { ...definition.data }, setData(value) { Object.assign(this.data, value); },
    async loadCoupons() {}, loadSubscriptionSettings() {}, async requestBookingSubscription() {},
  };
  page.onLoad({ data: encodeURIComponent(JSON.stringify({ servicePriceFen: 5000, extraServiceFeeFen: 0, staffId: 'p', salonId: 's', serviceId: 'v', startTime: '2030-01-01T10:00:00' })) });
  await page.submit();
  assert.equal(requests[0].expectedOriginalAmountFen, 5000);
  assert.equal(requests[0].expectedPayableAmountFen, 5000);
  assert.equal(attempts, 1, 'never silently retry creating an order after repricing');
  assert.equal(page.data.successVisible, false);
  assert.equal(page.data.payableText, '¥80');
  assert.equal(notice.title, '价格已更新');
  await page.submit();
  assert.equal(requests[1].expectedOriginalAmountFen, 8000);
  assert.equal(requests[1].expectedPayableAmountFen, 8000);
  assert.equal(page.data.successVisible, true);
  assert.equal(page.data.payableText, '¥80');
});
