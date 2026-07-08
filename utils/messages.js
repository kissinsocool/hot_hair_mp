const READ_KEY = 'booking_read_message_key';

function latestMessageKey(orders) {
  if (!orders.length) return '';
  const latest = orders.slice().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
  return `${latest.id}:${latest.status}:${latest.updatedAt || ''}`;
}

function hasUnreadBookingMessages(orders, readKey) {
  const key = latestMessageKey(orders);
  return !!key && key !== readKey;
}

function selfCheck() {
  const oldOrder = { id: 1, status: 'pending', updatedAt: '2026-01-01T00:00:00.000Z' };
  const latest = { id: 1, status: 'accepted', updatedAt: '2026-01-02T00:00:00.000Z' };
  console.assert(latestMessageKey([oldOrder, latest]) === '1:accepted:2026-01-02T00:00:00.000Z', 'latest key');
  console.assert(hasUnreadBookingMessages([latest], ''), 'new latest should notify');
  console.assert(!hasUnreadBookingMessages([latest], latestMessageKey([latest])), 'read latest should not notify');
}

if (typeof module !== 'undefined' && require.main === module) selfCheck();

module.exports = {
  READ_KEY,
  hasUnreadBookingMessages,
  latestMessageKey
};
