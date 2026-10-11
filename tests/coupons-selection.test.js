const assert = require('node:assert/strict');

let pageDefinition;
let navigatedBack = false;
global.Page = (options) => { pageDefinition = options; };
global.wx = { navigateBack: () => { navigatedBack = true; } };

require('../pages/coupons/coupons');

const emitted = [];
const page = {
  ...pageDefinition,
  data: {
    coupons: [{ id: 'coupon-1' }, { id: 'coupon-2' }],
    selectedCouponId: ''
  },
  eventChannel: {
    emit: (_event, payload) => emitted.push(payload.id)
  },
  setData(values) { Object.assign(this.data, values); }
};

page.selectCoupon({ detail: { id: 'coupon-1' } });
assert.equal(page.data.selectedCouponId, 'coupon-1');
assert.deepEqual(page.data.coupons.map((coupon) => coupon.selected), [true, false]);

page.selectCoupon({ detail: { id: 'coupon-1' } });
assert.equal(page.data.selectedCouponId, '');
assert.deepEqual(page.data.coupons.map((coupon) => coupon.selected), [false, false]);
assert.deepEqual(emitted, ['coupon-1', '']);
assert.equal(navigatedBack, false);

delete global.Page;
delete global.wx;
