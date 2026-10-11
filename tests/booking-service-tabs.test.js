const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { SERVICE_TABS, serviceCategory, serviceMatchesCategory } = require('../utils/serviceCategories');
const { serviceTagLabels } = require('../utils/serviceTags');

assert.deepEqual(SERVICE_TABS.map((tab) => tab.label), ['剪发', '染烫', '头皮护理']);
assert.equal(serviceCategory({ tagIds: ['men'] }), 'cut');
assert.equal(serviceCategory({ tagIds: ['color'] }), 'colorPerm');
assert.equal(serviceCategory({ tagIds: ['perm'] }), 'colorPerm');
assert.equal(serviceCategory({ tagIds: ['color', 'scalp_care'] }), 'colorPerm');
assert.equal(serviceCategory({ tagIds: ['nutrition'] }), 'scalpCare');
assert.equal(serviceCategory({ tagIds: [] }), 'cut');
assert.equal(serviceMatchesCategory({ tagIds: ['color', 'scalp_care'] }, 'colorPerm'), true);
assert.equal(serviceMatchesCategory({ tagIds: ['color', 'scalp_care'] }, 'scalpCare'), true);
assert.equal(serviceMatchesCategory({ tagIds: ['color'] }, 'scalpCare'), false);
assert.deepEqual(serviceTagLabels(['men', 'curly', 'nutrition']), ['男士', '卷发', '营养']);

const pageDir = path.join(__dirname, '..', 'pages', 'booking');
const script = fs.readFileSync(path.join(pageDir, 'booking.js'), 'utf8');
const template = fs.readFileSync(path.join(pageDir, 'booking.wxml'), 'utf8');
const styles = fs.readFileSync(path.join(pageDir, 'booking.wxss'), 'utf8');

assert.match(script, /serviceCategory\(selectedService\)/);
assert.match(script, /filter\(\(service\) => serviceMatchesCategory\(service, this\.data\.activeServiceCategory\)\)/);
assert.match(template, /role="tablist"/);
assert.match(template, /bindtap="selectServiceCategory"/);
assert.match(template, /service-tab-slider \{\{activeServiceCategory\}\}/);
assert.match(template, /service-count-number">\{\{serviceOptions\.length\}\}/);
assert.match(template, /wx:if="\{\{item\.isNoPreference\}\}" class="staff-img no-preference"/);
assert.match(template, /class="no-preference-img" mode="aspectFill" src="\/assets\/icons\/who\.png"/);
assert.match(styles, /\.staff-img\.no-preference\s*\{[^}]*overflow:\s*hidden;[^}]*background:\s*#000;/s);
assert.match(styles, /\.no-preference-img\s*\{[^}]*transform:\s*scale\(1\.04\);/s);
assert.match(styles, /\.service-tab-slider\s*\{[^}]*transition: transform 220ms ease/s);
assert.match(styles, /padding: 14rpx 54rpx 14rpx 14rpx/);
