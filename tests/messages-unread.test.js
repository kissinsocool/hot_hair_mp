const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const home = fs.readFileSync(path.join(root, 'pages/home/home.js'), 'utf8');
const orders = fs.readFileSync(path.join(root, 'pages/orders/orders.js'), 'utf8');
const messages = fs.readFileSync(path.join(root, 'pages/messages/messages.js'), 'utf8');
const template = fs.readFileSync(path.join(root, 'pages/messages/messages.wxml'), 'utf8');

assert.match(home, /api\.request\('\/booking-messages\/unread-count'\)/);
assert.doesNotMatch(home, /requestAllPages\('\/bookings'\)[\s\S]*unreadBookingMessageCount/);
assert.match(orders, /api\.request\('\/booking-messages\/unread-count'\)/);
assert.match(messages, /requestPage\('\/booking-messages'/);
assert.match(messages, /method: 'PATCH',[\s\S]*through: result\.items\[0\]\.createdAt/);
assert.match(messages, /goHome\(\)[\s\S]*wx\.switchTab\(\{ url: '\/pages\/home\/home' \}\)/);
assert.match(template, /wx:for="\{\{messages\}\}"/);
assert.match(template, /class="nav-icon nav-home"[\s\S]*bindtap="goHome"[\s\S]*home_outlined\.png/);
