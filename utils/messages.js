const READ_KEY = 'booking_read_message_key';

function latestMessageKey(orders) {
  if (!orders.length) return '';
  return JSON.stringify(orders
    .map((order) => [String(order.id), String(order.status || '')])
    .sort(([left], [right]) => left.localeCompare(right)));
}

function hasUnreadBookingMessages(orders, readKey) {
  const key = latestMessageKey(orders);
  return !!key && key !== readKey;
}

function readMessageKey(orders) {
  const readKey = wx.getStorageSync(READ_KEY) || '';
  if (!readKey || readKey.startsWith('[')) return readKey;

  const [readId, readStatus] = readKey.split(':');
  const statusUnchanged = orders.some((order) =>
    String(order.id) === readId && String(order.status || '') === readStatus);
  if (!statusUnchanged) return readKey;

  const migratedKey = latestMessageKey(orders);
  wx.setStorageSync(READ_KEY, migratedKey);
  return migratedKey;
}

function selfCheck() {
  const readOrder = { id: 1, status: 'completed', updatedAt: '2026-01-01T00:00:00.000Z', reviewed: true };
  const readKey = latestMessageKey([readOrder]);
  const reviewDeleted = { ...readOrder, updatedAt: '2026-01-02T00:00:00.000Z', reviewed: false };
  console.assert(!hasUnreadBookingMessages([reviewDeleted], readKey), 'review changes should not notify');
  console.assert(hasUnreadBookingMessages([{ ...reviewDeleted, status: 'accepted' }], readKey), 'status changes should notify');
}

if (typeof module !== 'undefined' && require.main === module) selfCheck();

module.exports = {
  READ_KEY,
  hasUnreadBookingMessages,
  latestMessageKey,
  readMessageKey
};
