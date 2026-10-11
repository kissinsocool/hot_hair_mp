const assert = require('node:assert/strict');
const { staffRoleLabel } = require('../utils/staffRoles');

assert.equal(staffRoleLabel('senior_designer'), '资深设计师');
assert.equal(staffRoleLabel('technical_store_manager'), '技术店长');
assert.equal(staffRoleLabel('unknown'), '');
