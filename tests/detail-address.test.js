const assert = require('node:assert/strict');

let pageDefinition;
global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api' } });
global.Page = (options) => { pageDefinition = options; };
global.wx = {};

require('../pages/detail/detail');

assert.equal(pageDefinition.formatAddress('浙江省杭州市西湖区古荡街道文三路90号'), '古荡街道文三路90号');
assert.equal(pageDefinition.formatAddress('上海市浦东新区张江路88号'), '张江路88号');
assert.equal(pageDefinition.formatAddress('河南省周口市项城市建设路1号'), '建设路1号');
assert.equal(pageDefinition.formatAddress('广西壮族自治区南宁市青秀区民族大道'), '民族大道');
assert.equal(pageDefinition.formatAddress('西湖区文三路90号'), '文三路90号');
assert.equal(pageDefinition.formatAddress('文三路90号'), '文三路90号');
assert.equal(pageDefinition.formatAddress(''), '地址未知');

delete global.Page;
delete global.wx;
delete global.getApp;
