const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const styles = fs.readFileSync(path.join(__dirname, '../pages/home/home.wxss'), 'utf8');
const template = fs.readFileSync(path.join(__dirname, '../pages/home/home.wxml'), 'utf8');
const cardRule = styles.match(/\.salon-card\s*\{([^}]*)\}/s);
const imageWrapRule = styles.match(/\.salon-image-wrap\s*\{([^}]*)\}/s);
const imageRule = styles.match(/\.salon-image\s*\{([^}]*)\}/s);

assert.ok(cardRule);
assert.match(cardRule[1], /margin:\s*0 22rpx 20rpx;/);
assert.match(cardRule[1], /border-radius:\s*20rpx;/);
assert.match(cardRule[1], /animation:\s*salon-card-slide-in 480ms cubic-bezier\(0\.22, 0\.8, 0\.32, 1\) both;/);
assert.ok(imageWrapRule);
assert.match(imageWrapRule[1], /width:\s*calc\(291\.2rpx \+ 12\.6px\);/);
assert.match(imageWrapRule[1], /height:\s*calc\(220rpx \+ 10px\);/);
assert.match(imageWrapRule[1], /flex:\s*0 0 calc\(291\.2rpx \+ 12\.6px\);/);
assert.ok(imageRule);
assert.match(template, /<image[^>]*class="salon-image"[^>]*mode="aspectFill"/);
assert.match(template, /class="salon-image-placeholder" aria-hidden="true">靓丝美约<\/text>/);
assert.match(template, /wx:for="\{\{salonCards\}\}"[^>]*wx:key="cardKey"[^>]*class="salon-card" style="animation-delay: \{\{salonIndex \* 70\}\}ms;"/);
assert.match(template, /<image wx:if="\{\{!item\.isPlaceholder\}\}" class="salon-image"/);
assert.doesNotMatch(template, /salon-card-flipper|salon-card-face|salon-card-back/);
assert.match(styles, /@keyframes salon-card-slide-in\s*\{[\s\S]*?translateX\(-80rpx\)[\s\S]*?translateX\(0\)/);
assert.match(styles, /\.salon-card-border-light\s*\{[^}]*pointer-events:\s*none;/s);
