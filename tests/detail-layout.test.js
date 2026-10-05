const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const template = fs.readFileSync(path.join(root, 'pages/detail/detail.wxml'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'pages/detail/detail.wxss'), 'utf8');

const promoIndex = template.indexOf('class="promo"');
const introIndex = template.indexOf('class="salon-intro"');
const infoIndex = template.indexOf('>店铺信息</view>');
const heroIndex = template.indexOf('class="hero"');
const heartIndex = template.indexOf('class="heart"');
const headingIndex = template.indexOf('class="detail-heading"');
const ratingIndex = template.indexOf('class="stars"');

assert.ok(promoIndex >= 0 && promoIndex < introIndex && introIndex < infoIndex);
assert.ok(heroIndex >= 0 && heroIndex < heartIndex && heartIndex < headingIndex && headingIndex < ratingIndex);
assert.match(template, /class="heart" catchtap="toggleFavorite"/);
assert.match(template, /class="detail-heading">\{\{salon\.name\}\}\{\{salon\.description \? ' ' \+ salon\.description : ''\}\}<\/view>/);
assert.doesNotMatch(template, />关于我们</);
assert.doesNotMatch(template, /class="hero-(?:mask|title)"/);
assert.match(styles, /\.hours\s*\{[^}]*color:\s*#c8c8c8;/s);
assert.match(styles, /\.detail-heading\s*\{[^}]*color:\s*#333;[^}]*font-size:\s*40rpx;[^}]*font-weight:\s*700;/s);
assert.match(styles, /\.heart\s*\{[^}]*position:\s*absolute;[^}]*top:\s*20rpx;[^}]*right:\s*20rpx;[^}]*background:\s*rgba\(255, 255, 255, 0\.3\);/s);
assert.match(styles, /\.stars \.star-icon\s*\{[^}]*filter:\s*hue-rotate\(296deg\) saturate\(0\.55\) brightness\(0\.78\);/s);
assert.match(styles, /\.section-title\s*\{[^}]*font-size:\s*29rpx;/s);
assert.match(styles, /\.promo-dots\s*\{[^}]*padding:\s*28rpx 0;/s);
assert.match(styles, /\.salon-intro\s*\{[^}]*margin:\s*0 0 36rpx;/s);
