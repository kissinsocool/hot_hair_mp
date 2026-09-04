const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pageDir = path.join(__dirname, '..', 'pages', 'home');
const script = fs.readFileSync(path.join(pageDir, 'home.js'), 'utf8');
const template = fs.readFileSync(path.join(pageDir, 'home.wxml'), 'utf8');
const styles = fs.readFileSync(path.join(pageDir, 'home.wxss'), 'utf8');

assert.match(script, /tags: Array\.isArray\(salon\.tags\)/);
assert.match(template, /class="salon-tags"/);
assert.match(template, /wx:for="\{\{item\.tags\}\}"/);
assert.match(template, /wx:for-index="tagIndex"/);
assert.match(template, /tagIndex == 1 \? 'salon-tag-lime' : ''/);
assert.match(template, /class="salon-tag-text"/);
assert.match(styles, /\.salon-tags\s*\{[^}]*position:\s*absolute;[^}]*width:\s*250rpx;/s);
assert.match(styles, /\.salon-tag\s*\{[^}]*max-width:\s*100%;[^}]*text-overflow:\s*ellipsis;/s);
assert.match(styles, /linear-gradient\(105deg, #7c4dff 0%, #ff4f91 58%, #ffad63 100%\)/);
assert.match(styles, /\.salon-tag-text\s*\{[^}]*linear-gradient\(110deg, #f3c94d 0%, #fff1a6 20%, #ffffea 40%, #f6d55c 57%, #fff9cf 76%, #e8b72f 100%\)/s);
assert.match(styles, /-webkit-background-clip: text;/);
assert.match(styles, /\.salon-tag::after\s*\{[^}]*animation:\s*salon-tag-shine 2\.8s ease-in-out infinite;/s);
assert.match(styles, /@keyframes salon-tag-shine/);
assert.match(styles, /\.salon-tag-lime\s*\{[^}]*linear-gradient\(105deg, #e9ff73 0%, #b7ed48 55%, #74cc35 100%\)/s);
assert.match(styles, /\.salon-tag-lime \.salon-tag-text\s*\{[^}]*-webkit-text-fill-color:\s*#245524;/s);
