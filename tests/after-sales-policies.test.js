const assert = require('node:assert/strict');
const { afterSalesPolicyLabels } = require('../utils/afterSalesPolicies');

assert.deepEqual(afterSalesPolicyLabels([
  'haircut_7_day_adjustment',
  'unknown',
  'color_perm_15_day_redo',
  'no_active_sales',
  'unsatisfied_no_charge',
  'no_hidden_charges',
  'haircut_7_day_adjustment'
]), [
  '剪发七日内不满意可重新调整',
  '染烫十五日内不满意免费重做',
  '不主动推销',
  '不满意免单',
  '无隐形消费'
]);
assert.deepEqual(afterSalesPolicyLabels(undefined), []);
