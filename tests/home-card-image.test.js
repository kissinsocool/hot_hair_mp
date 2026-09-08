const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const styles = fs.readFileSync(path.join(__dirname, '../pages/home/home.wxss'), 'utf8');
const template = fs.readFileSync(path.join(__dirname, '../pages/home/home.wxml'), 'utf8');
const imageRule = styles.match(/\.salon-image\s*\{([^}]*)\}/s);

assert.ok(imageRule);
assert.match(imageRule[1], /width:\s*calc\(330rpx \+ 15px\);/);
assert.match(imageRule[1], /height:\s*calc\(220rpx \+ 10px\);/);
assert.match(imageRule[1], /flex:\s*0 0 calc\(330rpx \+ 15px\);/);
assert.match(template, /<image class="salon-image" mode="aspectFill"/);
