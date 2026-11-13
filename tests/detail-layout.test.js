const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
// 只检查真实页面结构；加载占位模板沿用同样的类名，不计入。
const template = fs.readFileSync(path.join(root, 'pages/detail/detail.wxml'), 'utf8')
  .replace(/<template name="detail-body-skeleton">[\s\S]*?<\/template>/, '')
  // <import> 只引入模板，不渲染内容。
  .replace(/^<import [^>]*\/>\n/gm, '')
  .replace(/^<!--[^\n]*-->\n/gm, '');
const styles = fs.readFileSync(path.join(root, 'pages/detail/detail.wxss'), 'utf8');
const sharedStyles = fs.readFileSync(path.join(root, 'app.wxss'), 'utf8');

const promoIndex = template.indexOf('class="promo"');
const introIndex = template.indexOf('class="salon-intro"');
const infoIndex = template.indexOf('class="card info-card"');
const headTopIndex = template.indexOf('class="head-top"');
const heartIndex = template.indexOf('class="heart"');
const headingIndex = template.indexOf('class="detail-heading"');
const ratingIndex = template.indexOf('class="stars"');

assert.ok(promoIndex >= 0 && promoIndex < introIndex && introIndex < infoIndex);
assert.doesNotMatch(template, />店铺信息<\/view>/);
// 收藏按钮放在店铺名称上方一行，不再叠在店铺大图上。
// 店铺封面大图已隐藏，名称区直接位于页面顶部。
assert.doesNotMatch(template, /class="hero/);
assert.ok(headTopIndex >= 0 && headTopIndex && headTopIndex < heartIndex && heartIndex < headingIndex && headingIndex < ratingIndex);
assert.match(template, /class="heart" bindtap="toggleFavorite"/);
assert.match(template, /class="detail-heading">\{\{salon\.name\}\}\{\{salon\.description \? ' 「' \+ salon\.description \+ '」' : ''\}\}<\/view>/);
assert.equal((template.match(/class="section"/g) || []).length, 4);
assert.doesNotMatch(template, /class="card section"/);
assert.match(template, /class="card info-card"/);
assert.doesNotMatch(template, />关于我们</);
assert.match(styles, /\.hours\s*\{[^}]*color:\s*#c8c8c8;/s);
assert.match(styles, /\.detail-heading\s*\{[^}]*color:\s*#333;[^}]*font-size:\s*36rpx;[^}]*font-weight:\s*700;/s);
// 精选标签单独一行，在商圈和收藏按钮所在行的上方。
const badgeIndex = template.indexOf('class="featured-badge"');
const districtIndex = template.indexOf('class="head-district"');
assert.ok(badgeIndex >= 0 && badgeIndex < headTopIndex && headTopIndex < districtIndex && districtIndex < heartIndex);
assert.match(template, /wx:if="\{\{salon\.businessDistrict\}\}" class="head-district">\{\{salon\.businessDistrict\}\}<\/view>/);
assert.match(styles, /\.featured-badge\s*\{[^}]*margin-bottom:\s*16rpx;/s);
assert.match(styles, /\.head-district\s*\{[^}]*color:\s*#66575a;[^}]*font-size:\s*28rpx;/s);
assert.doesNotMatch(styles, /after-badge/);
assert.match(styles, /\.head-top\s*\{[^}]*display:\s*flex;/s);
assert.match(styles, /\.heart\s*\{[^}]*margin:\s*-10rpx -10rpx -10rpx auto;/s);
assert.doesNotMatch(sharedStyles, /\.rating-star\s*\{[^}]*filter\s*:/s);
assert.match(styles, /\.section-title\s*\{[^}]*font-size:\s*27rpx;/s);
assert.match(styles, /\.promo-dots\s*\{[^}]*padding:\s*28rpx 0;/s);
assert.match(styles, /\.salon-intro\s*\{[^}]*margin:\s*0 0 36rpx;/s);

// 导航栏下方白条与收藏页、我的页共用同一样式，详情页不单独改高度。
assert.ok(template.startsWith('<view class="native-tab-header-extension" aria-hidden="true"></view>'));
assert.doesNotMatch(styles, /\.native-tab-header-extension/);
