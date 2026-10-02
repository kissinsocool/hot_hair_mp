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
assert.match(template, /class="salon-tags"/);
assert.match(template, /wx:for="\{\{item\.tags\}\}"/);
assert.match(template, /class="salon-tag \{\{tag\.colorClass\}\}"/);
assert.match(template, /\{\{tag\.text\}\}/);
assert.match(template, /class="salon-tag-text"/);
assert.match(styles, /\.salon-tags\s*\{[^}]*position:\s*absolute;[^}]*width:\s*250rpx;/s);
assert.match(styles, /\.salon-tag\s*\{[^}]*max-width:\s*100%;[^}]*font-weight:\s*600;[^}]*text-overflow:\s*ellipsis;/s);
assert.doesNotMatch(styles, /\.salon-tag-royal\s*\{/);
assert.match(styles, /\.salon-tag-text\s*\{[^}]*linear-gradient\(110deg, #f3c94d 0%, #fff1a6 20%, #ffffea 40%, #f6d55c 57%, #fff9cf 76%, #e8b72f 100%\)/s);
assert.match(styles, /-webkit-background-clip: text;/);
assert.match(styles, /\.salon-tag::after\s*\{[^}]*animation:\s*salon-tag-shine 2\.8s ease-in-out infinite;/s);
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
