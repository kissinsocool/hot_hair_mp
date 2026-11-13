const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const template = fs.readFileSync(path.join(__dirname, '../pages/staff/staff.wxml'), 'utf8');
const skeleton = template.match(/<view wx:if="\{\{loading\}\}" class="staff-page"[\s\S]*?<view wx:else class="staff-page">/)[0];

// 占位沿用真实区块的类名，顺序与页面一致；「立即预约」不画占位。
let last = -1;
for (const marker of ['class="profile"', 'class="avatar skeleton-block', 'staff-skeleton-name', 'staff-skeleton-role',
  'staff-skeleton-rating', 'class="favorite"', 'class="card section"', '客户评价', 'staff-skeleton-reviewer']) {
  const index = skeleton.indexOf(marker);
  assert.ok(index > last, marker);
  last = index;
}
assert.doesNotMatch(skeleton, /立即预约|class="bar"/);
assert.doesNotMatch(template, /class="empty">正在加载/);
