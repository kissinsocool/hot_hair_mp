const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pageDir = path.join(__dirname, '..', 'pages', 'orders');
const template = fs.readFileSync(path.join(pageDir, 'orders.wxml'), 'utf8');
const styles = fs.readFileSync(path.join(pageDir, 'orders.wxss'), 'utf8');

const actionsRule = styles.match(/\.actions\s*\{([^}]*)\}/s)?.[1] || '';
const buttonRule = styles.match(/\.order-button\s*\{([^}]*)\}/s)?.[1] || '';

assert.match(template, /wx:if="\{\{item\.canReview\}\}"[^>]*catchtap="review"[\s\S]*wx:if="\{\{item\.canRebook\}\}"[^>]*catchtap="rebook"[^>]*>再次预约<\/button>/);
assert.match(template, /wx:if="\{\{item\.canCancel\}\}"[^>]*catchtap="cancel"/);
assert.doesNotMatch(template, /data-type="complaint"/);
assert.match(template, /class="card order order-\{\{item\.status\}\}"/);
assert.match(template, /\{\{item\.cardStatusLabel\}\}/);
assert.match(template, /\{\{item\.cardStartTimeText\}\}/);
assert.match(template, /\{\{item\.salonDescription \|\| '暂无简介'\}\}/);
assert.doesNotMatch(template, /预约理发师/);
const serviceLine = template.match(/<view class="service-name">(.*?)<\/view>/)?.[1];
assert.ok(serviceLine, 'order cards must render the service summary');
for (const [serviceDescription, expected] of [[undefined, '剪发'], ['', '剪发'], ['洗剪吹造型', '剪发 · 洗剪吹造型']]) {
  const item = { serviceName: '剪发', serviceDescription };
  const rendered = serviceLine.replace(/\{\{(.*?)\}\}/g, (_, expression) => new Function('item', `return (${expression});`)(item));
  assert.equal(rendered, expected);
}
assert.match(styles, /\.service-name,[^{]*\{[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/s, 'service name and description must share a single truncated line');
assert.match(template, /binderror="onSalonImageError"/);
assert.match(styles, /\.salon-info\s*\{[^}]*min-width:\s*0;/);
assert.match(styles, /text-overflow:\s*ellipsis;/);
assert.doesNotMatch(styles, /\.order-accepted\s*\{[^}]*border:/, 'confirmed reservations must not add a colored outline');
assert.match(styles, /\.order\s*\{[^}]*border:\s*0;[^}]*box-shadow:/s, 'order cards must use the reference borderless shadow treatment');
assert.match(styles, /\.status-accepted\s*\{[^}]*background:\s*#b73556;/, 'confirmed status must use the reference dark rose fill');
assert.match(template, /<view class="service-label">预约套餐<\/view>/);
assert.match(styles, /\.service-summary\s*\{[^}]*border-radius:\s*8rpx;[^}]*background:\s*#f6f6f6;/s, 'package details must use the reference gray rounded panel');
assert.match(styles, /\.rebook-button\s*\{[^}]*background:\s*#c56f85;[^}]*color:\s*#fff;/, 'rebooking must be the primary filled action');

assert.match(actionsRule, /flex-wrap:\s*nowrap;/, 'order actions must stay on one row');
assert.match(actionsRule, /justify-content:\s*flex-end;/, 'a single order action must align to the right');
assert.match(styles, /\.actions-single\s+\.order-button\s*\{\s*flex:\s*0\s+1\s+260rpx;/, 'single buttons must keep a bounded width');
const singleActionExpression = template.match(/class="actions \{\{(.*?)\}\}"/)?.[1];
assert.ok(singleActionExpression, 'single-button layout must use the same flags as button visibility');
const actionClass = new Function('item', `return (${singleActionExpression});`);
for (let mask = 0; mask < 8; mask++) {
  const flags = [Boolean(mask & 1), Boolean(mask & 2), Boolean(mask & 4)];
  const [canReview, canRebook, canCancel] = flags;
  assert.equal(actionClass({ canReview, canRebook, canCancel }), flags.filter(Boolean).length === 1 ? 'actions-single' : '');
}
assert.match(buttonRule, /flex:\s*1\s+1\s+0;/, 'order buttons must share the available width');
assert.match(buttonRule, /min-width:\s*0;/, 'order buttons must be allowed to shrink without overflowing narrow cards');
assert.match(styles, /\.actions\s+\.order-button\s*\{[^}]*margin:\s*0;/, 'button margins must override the native wx-button:not([size=mini]) auto margins');
