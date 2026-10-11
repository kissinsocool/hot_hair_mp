const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const orders = fs.readFileSync(path.join(root, 'pages/orders/orders.js'), 'utf8');
const ordersTemplate = fs.readFileSync(path.join(root, 'pages/orders/orders.wxml'), 'utf8');
const messages = fs.readFileSync(path.join(root, 'pages/messages/messages.js'), 'utf8');
const profile = fs.readFileSync(path.join(root, 'pages/profile/profile.js'), 'utf8');

assert.match(orders, /requestPage\('\/bookings'/);
assert.match(ordersTemplate, /bindscrolltolower="loadMore"/);
assert.match(messages, /requestPage\('\/booking-messages'/);
assert.match(messages, /onReachBottom\(\)/);
assert.match(profile, /requestPage\('\/auth\/reviews'/);
assert.match(profile, /activeTab === 'reviews'/);
assert.doesNotMatch(`${orders}\n${messages}\n${profile}`, /requestAllPages/);
