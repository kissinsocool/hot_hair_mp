const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const template = read('pages/booking/booking.wxml');
const skeleton = template.match(/<view wx:if="\{\{loading\}\}" class="page booking"[\s\S]*?<view wx:elif="\{\{errorMessage\}\}"/)[0];

// 预约页加载占位按真实页面的区块顺序排列，沿用真实类名，标题直接显示真实文字。
const order = ['class="hint"', '选择服务项目', 'class="service-tabs"', 'service-card-skeleton', '选择理发师',
  'class="staff-option"', '选择预约日期', 'class="date skeleton-block"', '可用时间段', 'class="chip skeleton-block"'];
let last = -1;
for (const marker of order) {
  const index = skeleton.indexOf(marker);
  assert.ok(index > last, marker);
  last = index;
}
assert.match(template, /^<import src="\/styles\/service-card-skeleton\.wxml" \/>/);
// 共用的套餐卡片占位在详情页和预约页使用同一份模板和样式。
const shared = read('styles/service-card-skeleton.wxml');
assert.match(shared, /<template name="service-card-skeleton">/);
for (const className of ['service-card', 'service-image-wrap', 'service-main', 'service-tags', 'service-meta']) {
  assert.match(shared, new RegExp(`class="${className}\\b`), className);
}
const styles = read('styles/service-card.wxss');
for (const className of ['tag', 'name', 'note', 'price', 'duration']) {
  assert.match(styles, new RegExp(`\\.service-skeleton-${className} \\{`), className);
}
// 调试包里也要带上共用模板（与共用样式相同的处理）。
const project = JSON.parse(read('project.config.json'));
assert.ok(project.packOptions.include.some((item) => item.value === 'styles/service-card-skeleton.wxml'));
