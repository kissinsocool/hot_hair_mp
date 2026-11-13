const assert = require('node:assert/strict');
const { appendPatch } = require('../utils/dataPatch');

assert.deepEqual(appendPatch('orders', [{ id: 1 }, { id: 2 }], [{ id: 3 }]), { 'orders[2]': { id: 3 } },
  'loading more sends only the new rows');
assert.deepEqual(appendPatch('orders', [], [{ id: 1 }]), { 'orders[0]': { id: 1 } });
assert.deepEqual(appendPatch('orders', [{ id: 1 }], []), {});
