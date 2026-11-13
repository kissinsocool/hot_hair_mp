const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

function loadConfirmPage(requests) {
  let definition;
  const api = {
    formatTime: value => value,
    async request(_path, options) {
      requests.push(options.data);
      return { booking: { servicePriceFen: 5000, staffExtraServiceFeeFen: 0, originalAmountFen: 5000, couponDiscountFen: 0, payableAmountFen: 5000 } };
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'pages/confirm/confirm.js'), 'utf8'), {
    Page: value => { definition = value; },
    require: name => name.endsWith('/api') ? api : name.endsWith('/money') ? { formatFen: amount => `¥${amount / 100}` } : {},
    wx: { showModal() {}, showToast() {} },
  });
  const page = { ...definition, data: { ...definition.data }, setData(value) { Object.assign(this.data, value); },
    async loadCoupons() {}, loadSubscriptionSettings() {}, async requestBookingSubscription() {},
  };
  page.onLoad({ data: encodeURIComponent(JSON.stringify({ servicePriceFen: 5000, extraServiceFeeFen: 0, staffId: 'p', salonId: 's', serviceId: 'v', startTime: '2030-01-01T10:00:00' })) });
  return page;
}

test('booking note is trimmed and submitted as the existing optional `note` field', async () => {
  const requests = [];
  const page = loadConfirmPage(requests);
  page.onNoteInput({ detail: { value: '  头皮敏感，请轻一点  ' } });
  await page.submit();
  assert.equal(requests[0].note, '头皮敏感，请轻一点');
});

test('blank booking note is omitted so the request matches the previous contract', async () => {
  const requests = [];
  const page = loadConfirmPage(requests);
  page.onNoteInput({ detail: { value: '   ' } });
  await page.submit();
  assert.equal(Object.prototype.hasOwnProperty.call(requests[0], 'note'), false);
});

test('booking note input is capped within the backend limit', () => {
  const page = loadConfirmPage([]);
  page.onNoteInput({ detail: { value: '字'.repeat(600) } });
  assert.equal(page.data.note.length, page.data.noteMaxLength);
  assert.ok(page.data.noteMaxLength <= 500, 'backend INPUT_LIMITS.note is 500');
  const template = fs.readFileSync(path.join(root, 'pages/confirm/confirm.wxml'), 'utf8');
  assert.match(template, /<textarea[^>]*maxlength="\{\{noteMaxLength\}\}"/s);
});
