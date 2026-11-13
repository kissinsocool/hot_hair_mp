const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const template = fs.readFileSync(path.join(root, 'pages/home/home.wxml'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'pages/home/home.wxss'), 'utf8');
const card = template.match(/wx:for="\{\{salonCards\}\}"[\s\S]*?<view wx:if="\{\{hasMoreSalons/)[0];

// 占位卡片按真实卡片的顺序画出各部分，并沿用真实容器类名。
const placeholderHead = card.match(/<block wx:if="\{\{item\.isPlaceholder\}\}">([\s\S]*?)<\/block>/)[1];
assert.match(placeholderHead, /class="salon-name home-skeleton-head"[\s\S]*home-skeleton-tag[\s\S]*class="salon-rating"/);
const placeholderBody = card.match(/<block wx:else>\s*<view class="home-skeleton-desc-row"([\s\S]*?)<\/block>/)[0];
let last = -1;
for (const marker of ['home-skeleton-desc', 'class="salon-info"', 'home-skeleton-address', 'home-skeleton-reviews',
  'home-skeleton-price', 'class="salon-cta home-skeleton-cta-row"', 'class="favorite"']) {
  const index = placeholderBody.indexOf(marker);
  assert.ok(index > last, marker);
  last = index;
}
// 底部操作只画占位，不显示可点击的真实文字。
assert.doesNotMatch(placeholderBody, /查看店铺详情|catchtap/);
// 卡片高度由内容撑开，不再固定。
assert.doesNotMatch(styles, /\.salon-card--loading\s*\{[^}]*height/);
