const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const template = fs.readFileSync(path.join(__dirname, '../pages/order-detail/order-detail.wxml'), 'utf8');
const skeleton = template.match(/<view wx:if="\{\{loading && !order\}\}"[\s\S]*?<view wx:elif="\{\{errorMessage && !order\}\}"/)[0];

// 占位沿用真实区块的类名和标签文字，顺序与页面一致。
let last = -1;
for (const marker of ['class="status-card card"', '预约信息', '服务项目', '到店时间', '商家名称', '指定理发师',
  '费用明细', 'class="card panel fee-panel"', '服务费用', '到店需支付']) {
  const index = skeleton.indexOf(marker);
  assert.ok(index > last, marker);
  last = index;
}
// 费用明细不再显示「费用合计」，占位也一致。
assert.doesNotMatch(template, /费用合计/);
assert.match(template, /<text>指定理发师<\/text><text>\{\{order\.staffName\}\}<\/text>/);
// 只在部分订单出现的区块不画占位。
assert.doesNotMatch(skeleton, /订单问题|再次预约|bottom-actions/);
// 已有订单数据时（返回页面重新读取）不显示占位。
assert.doesNotMatch(template, /class="empty">正在加载/);
