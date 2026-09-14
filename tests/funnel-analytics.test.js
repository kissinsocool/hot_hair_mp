const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const source = file => fs.readFileSync(path.join(root, file), 'utf8');

assert.match(source('pages/home/home.js'), /track\('home_exposure'/);
assert.match(source('pages/home/home.js'), /track\('salon_detail_click'/);
assert.match(source('pages/detail/detail.js'), /track\('service_click'/);
assert.match(source('pages/booking/booking.js'), /track\('booking_started'/);
assert.match(source('pages/booking/booking.js'), /track\('slot_selected'/);
assert.match(source('pages/orders/orders.js'), /track\('rebooking_started'/);
assert.match(source('pages/orders/orders.wxml'), />再次预约<\/button>/);
