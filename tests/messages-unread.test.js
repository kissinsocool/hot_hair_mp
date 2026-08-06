const assert = require('node:assert/strict');

const messages = require('../utils/messages');

const readOrders = [
  { id: 'booking-2', status: 'completed', updatedAt: '2026-08-01T10:00:00.000Z', reviewed: true },
  { id: 'booking-1', status: 'accepted', updatedAt: '2026-08-01T09:00:00.000Z' }
];
const readKey = messages.latestMessageKey(readOrders);

const reviewDeleted = readOrders.map((order) => order.id === 'booking-2'
  ? { ...order, reviewed: false, updatedAt: '2026-08-02T10:00:00.000Z' }
  : order);

assert.equal(messages.hasUnreadBookingMessages(reviewDeleted, readKey), false);
assert.equal(messages.hasUnreadBookingMessages(reviewDeleted.slice().reverse(), readKey), false);
assert.equal(messages.hasUnreadBookingMessages([
  reviewDeleted[0],
  { ...reviewDeleted[1], status: 'completed', updatedAt: '2026-08-02T11:00:00.000Z' }
], readKey), true);
assert.equal(messages.hasUnreadBookingMessages([
  ...reviewDeleted,
  { id: 'booking-3', status: 'pending', updatedAt: '2026-08-02T12:00:00.000Z' }
], readKey), true);

let storedKey = 'booking-2:completed:2026-08-01T10:00:00.000Z';
global.wx = {
  getStorageSync: () => storedKey,
  setStorageSync: (_key, value) => { storedKey = value; }
};
assert.equal(messages.readMessageKey(reviewDeleted), messages.latestMessageKey(reviewDeleted));
assert.equal(storedKey, messages.latestMessageKey(reviewDeleted));

storedKey = 'booking-2:accepted:2026-08-01T10:00:00.000Z';
assert.equal(messages.readMessageKey(reviewDeleted), storedKey);
delete global.wx;
