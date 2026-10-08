const assert = require('node:assert/strict');
const { afterSalesPolicyLabels } = require('../utils/afterSalesPolicies');

assert.deepEqual(afterSalesPolicyLabels([
  'haircut_7_day_adjustment',
  'unknown',
  'color_perm_15_day_redo',
  'haircut_7_day_adjustment'
]), [
  '剪发七日内不满意免费重新调整',
  '染烫十五日内不满意免费重做'
]);
assert.deepEqual(afterSalesPolicyLabels(undefined), []);
