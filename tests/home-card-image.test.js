const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const styles = fs.readFileSync(path.join(__dirname, '../pages/home/home.wxss'), 'utf8');
const template = fs.readFileSync(path.join(__dirname, '../pages/home/home.wxml'), 'utf8');
const cardRule = styles.match(/\.salon-card\s*\{([^}]*)\}/s);
const imageWrapRule = styles.match(/\.salon-image-wrap\s*\{([^}]*)\}/s);
const imageRule = styles.match(/\.salon-image\s*\{([^}]*)\}/s);

assert.ok(cardRule);
assert.match(cardRule[1], /margin:\s*0 30\.5rpx 30\.5rpx;/);
assert.match(cardRule[1], /border-radius:\s*15\.3rpx;/);
assert.match(cardRule[1], /overflow:\s*hidden;/);
assert.doesNotMatch(cardRule[1], /animation:/);
assert.ok(imageWrapRule);
assert.match(imageWrapRule[1], /width:\s*306\.6rpx;/);
assert.match(imageWrapRule[1], /height:\s*229\.6rpx;/);
assert.match(imageWrapRule[1], /border:\s*2rpx solid #e0e1e1;/);
assert.match(styles, /\.salon-gallery\s*\{[^}]*height:\s*229\.6rpx;[^}]*margin:\s*26rpx -30\.5rpx 0 0;[^}]*white-space:\s*nowrap;/s);
assert.match(template, /<scroll-view class="salon-gallery" scroll-x enhanced show-scrollbar="\{\{false\}\}">/);
assert.match(template, /wx:for="\{\{item\.images\}\}" wx:for-item="image" wx:for-index="imageIndex" wx:key="\*this" class="salon-image-wrap"/);
assert.match(template, /data-card-index="\{\{salonIndex\}\}" data-image-index="\{\{imageIndex\}\}" data-src="\{\{image\}\}"/);
assert.match(template, /favorite_pink\.svg' : '\/assets\/icons\/favorite_border_ink\.svg'/);
// 右上角是一颗粉星加评分，暂无评分的店铺暂时显示 5；收藏按钮在卡片右下角的底部栏里。
assert.match(template, /class="salon-name">[\s\S]*?<\/view>\s*<view wx:if="\{\{!item\.isPlaceholder\}\}" class="salon-rating"><image class="star-icon rating-star" mode="aspectFit" src="\/assets\/icons\/star_gold\.png" \/>\{\{item\.hasRating \? item\.ratingText : '5'\}\}<\/view>\s*<\/view>\s*<scroll-view/);
assert.match(template, /wx:if="\{\{item\.cutPriceText\}\}" class="salon-info-item">[\s\S]*?\{\{item\.cutPriceText\}\}/);
assert.match(template, /<view class="salon-cta">\s*<text>查看店铺详情<\/text>\s*<view class="favorite" catchtap="toggleFavorite" data-id="\{\{item\.id\}\}"/);
assert.match(styles, /\.salon-cta\s*\{[^}]*position:\s*relative;/s);
assert.match(styles, /\.favorite\s*\{[^}]*position:\s*absolute;[^}]*top:\s*50%;[^}]*right:\s*-19rpx;[^}]*margin-top:\s*-40rpx;/s);
assert.doesNotMatch(template, /star_gray|评分 \{\{/);
for (const icon of ['favorite_pink', 'favorite_border_ink', 'location_on_gray', 'chat_bubble_gray', 'yen_gray']) {
  assert.ok(fs.existsSync(path.join(__dirname, `../assets/icons/${icon}.svg`)), icon);
  assert.match(template, new RegExp(`/assets/icons/${icon}\\.svg`));
}
assert.ok(imageRule);
assert.match(template, /<image[^>]*class="salon-image"[^>]*mode="aspectFill"/);
assert.match(template, /<image[^>]*class="salon-image"[^>]*webp="\{\{true\}\}"[^>]*binderror="onSalonImageError"/);
assert.match(template, /class="salon-image-placeholder" aria-hidden="true">靓丝美约<\/text>/);
assert.match(template, /wx:for="\{\{salonCards\}\}"[^>]*wx:key="cardKey"[^>]*class="salon-card \{\{item\.isPlaceholder \? 'salon-card--loading' : ''\}\} \{\{visibleSalonCards\[salonIndex\] \? 'salon-card--visible' : ''\}\}"[^>]*data-card-index="\{\{salonIndex\}\}"/);
assert.match(template, /salon-card-border-light \{\{visibleSalonCards\[salonIndex\] \? 'salon-card-border-light--active' : ''\}\}/);
assert.match(template, /<image wx:if="\{\{image\}\}" class="salon-image"/);
assert.doesNotMatch(template, /salon-card-flipper|salon-card-face|salon-card-back/);
assert.doesNotMatch(styles, /salon-card-slide-in/);
assert.match(styles, /\.salon-card-border-light\s*\{[^}]*pointer-events:\s*none;[^}]*animation:\s*salon-border-fade 11800ms linear infinite;/s);
assert.match(styles, /\.salon-card-border-light::before\s*\{[^}]*animation:\s*salon-border-travel 11800ms linear infinite;/s);
assert.match(styles, /@keyframes salon-border-travel\s*\{[\s\S]*?0%[\s\S]*?15\.25%, 100%/);
assert.match(styles, /@keyframes salon-border-fade\s*\{[\s\S]*?0%, 15\.25%, 100%[\s\S]*?1\.22%, 13\.73%/);
assert.match(styles, /\.salon-card-border-light--active,[\s\S]*?animation-play-state:\s*running;/);
