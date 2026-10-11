const assert = require('node:assert/strict');
const { formatFen, formatFenAmount } = require('../utils/money');

assert.equal(formatFen(19900), '¥199');
assert.equal(formatFen(19950), '¥199.50');
assert.equal(formatFen(19905), '¥199.05');
assert.equal(formatFen(199900), '¥1,999');
assert.equal(formatFenAmount(2000), '20');
