const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

let pageDefinition;
const navigations = [];
global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api' } });
global.Page = (options) => { pageDefinition = options; };
global.wx = {
  getStorageSync() { return null; },
  navigateTo(options) { navigations.push(options.url); }
};

require('../pages/home/home');

assert.deepEqual(pageDefinition.data.salonCategories.map((category) => category.label), [
  '女士精剪', '男士精剪', '染发', '卷发', '直发', '发质改善'
]);

pageDefinition.openSalonCategory({ currentTarget: { dataset: { category: 'curly' } } });
assert.deepEqual(navigations, ['/pages/style-gallery/style-gallery?category=curly']);

const template = fs.readFileSync(path.join(__dirname, '../pages/home/home.wxml'), 'utf8');
const styles = fs.readFileSync(path.join(__dirname, '../pages/home/home.wxss'), 'utf8');
assert.match(template, /class="category-finder-title">按分类查找<\/view>/);
assert.match(template, /class="category-finder"/);
assert.match(template, /wx:for="\{\{salonCategories\}\}"/);
assert.match(template, /bindtap="openSalonCategory"/);
assert.match(styles, /\.category-finder-item\s*\{[^}]*width:\s*50%;[^}]*height:\s*148rpx;/s);
assert.match(styles, /\.category-finder-image\s*\{[^}]*width:\s*100rpx;[^}]*height:\s*120rpx;/s);
