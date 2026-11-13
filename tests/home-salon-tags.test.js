const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pageDir = path.join(__dirname, '..', 'pages', 'home');
const script = fs.readFileSync(path.join(pageDir, 'home.js'), 'utf8');
const template = fs.readFileSync(path.join(pageDir, 'home.wxml'), 'utf8');
const styles = fs.readFileSync(path.join(pageDir, 'home.wxss'), 'utf8');

assert.match(script, /tags: \(Array\.isArray\(salon\.tags\)/);
assert.match(script, /const SALON_TAG_CLASSES = \['salon-tag-neon', 'salon-tag-nature'\]/);
assert.doesNotMatch(script, /shuffledSalonTagClasses/);
// 高光标签紧跟在店名后面，只显示第一个；首页简介在图片组和定位行之间。
assert.match(template, /class="salon-name">\s*<text>\{\{item\.nameText\}\}<\/text><view wx:if="\{\{item\.tags\.length\}\}" class="salon-tag \{\{item\.tags\[0\]\.colorClass\}\}"><text class="salon-tag-text">\{\{item\.tags\[0\]\.text\}\}<\/text><\/view>\s*<view wx:if="\{\{item\.isFeatured\}\}" class="featured-badge"><text>靓丝精选<\/text><\/view>\s*<\/view>/);
assert.match(styles, /@import '\.\.\/\.\.\/styles\/featured-badge\.wxss';/);
assert.equal(template.match(/class="salon-tag /g).length, 1);
assert.doesNotMatch(template, /wx:for="\{\{item\.tags\}\}"|class="salon-tags"/);
assert.match(template, /<\/scroll-view>[\s\S]*?<view wx:if="\{\{item\.introText\}\}" class="salon-desc">\{\{item\.introText\}\}<\/view>\s*<view class="salon-info">/);
const salonNameStyles = styles.match(/\.salon-name\s*\{([^}]*)\}/)[1];
assert.match(salonNameStyles, /word-break:\s*break-all;/);
assert.match(salonNameStyles, /max-height:\s*none;/);
// 全局 .salon-name 会裁剪溢出，标签的阴影需要露在店名的盒子外面。
assert.match(salonNameStyles, /overflow:\s*visible;/);
assert.doesNotMatch(salonNameStyles, /line-clamp:|text-overflow:/);
assert.match(styles, /\.salon-desc\s*\{[^}]*overflow:\s*hidden;[^}]*-webkit-line-clamp:\s*2;/s);
assert.match(styles, /\.salon-name \.salon-tag\s*\{[^}]*display:\s*inline-block;[^}]*margin-left:\s*12rpx;[^}]*vertical-align:\s*-8rpx;/s);
const salonTagStyles = styles.match(/^\.salon-tag\s*\{([^}]*)\}/m)[1];
assert.match(salonTagStyles, /max-width:\s*calc\(100% - 12rpx\);/);
assert.match(salonTagStyles, /font-weight:\s*600;/);
assert.doesNotMatch(salonTagStyles, /text-overflow:|white-space:\s*nowrap/);
assert.doesNotMatch(styles, /\.salon-tag-royal\s*\{|\.salon-tags\s*\{/);
assert.match(styles, /\.salon-tag-text\s*\{[^}]*linear-gradient\(110deg, #f3c94d 0%, #fff1a6 20%, #ffffea 40%, #f6d55c 57%, #fff9cf 76%, #e8b72f 100%\)/s);
assert.match(styles, /-webkit-background-clip: text;/);
assert.match(styles, /\.salon-tag::after\s*\{[^}]*animation:\s*salon-tag-shine 2\.8s ease-in-out infinite;/s);
assert.match(styles, /\.salon-card--visible \.salon-tag::after\s*\{[^}]*animation-play-state:\s*running;/s);
assert.match(styles, /@keyframes salon-tag-shine/);
assert.match(styles, /\.salon-tag-nature\s*\{[^}]*linear-gradient\(105deg, #56ab2f 0%, #a8e063 100%\)/s);
assert.match(styles, /\.salon-tag-nature \.salon-tag-text\s*\{[^}]*-webkit-text-fill-color:\s*#245524;/s);
assert.match(styles, /\.salon-tag-neon\s*\{[^}]*linear-gradient\(105deg, #ff00cc 0%, #3333ff 100%\)/s);

let pageDefinition;
global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api', mediaBaseUrl: '', session: null } });
global.wx = { getStorageSync: () => null };
global.Page = (options) => { pageDefinition = options; };
require('../pages/home/home');

const tags = pageDefinition.normalizeSalon({ tags: ['标签一', '标签二', '标签三'] }).tags;
assert.deepEqual(tags.map((tag) => tag.text), ['标签一', '标签二', '标签三']);
assert.deepEqual(
  tags.map((tag) => tag.colorClass),
  ['salon-tag-neon', 'salon-tag-nature', 'salon-tag-neon']
);
assert.deepEqual(pageDefinition.normalizeSalon({ tags: 'bad' }).tags, []);

const page = {
  ...pageDefinition,
  data: { ...pageDefinition.data },
  setData(values) { Object.assign(this.data, values); }
};
page.renderSalons([
  page.normalizeSalon({ id: 'tagged', isFeatured: true, tags: ['标签一', '标签二'] }),
  page.normalizeSalon({ id: 'featured-only', isFeatured: true }),
  page.normalizeSalon({ id: 'regular', isFeatured: false }),
  { id: 'raw' }
]);
assert.deepEqual(page.data.salonCards[0].tags, [{ text: '标签一', colorClass: 'salon-tag-neon' }]);
assert.deepEqual(page.data.salonCards[1].tags, []);
assert.deepEqual(page.data.salonCards.map((card) => card.isFeatured), [true, true, false, false]);

assert.equal(pageDefinition.normalizeSalon({ description: ' 用心做好每一个发型 ' }).introText, '用心做好每一个发型');
assert.equal(pageDefinition.normalizeSalon({}).introText, '');
