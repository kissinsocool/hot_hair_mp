const assert = require('node:assert/strict');

const requests = [];
global.getApp = () => ({
  globalData: { apiBaseUrl: 'https://example.com/api', mediaBaseUrl: '', session: null }
});
global.getCurrentPages = () => [];
global.wx = {
  getStorageSync: () => null,
  request(options) { requests.push(options); }
};

const api = require('../utils/api');

async function main() {
  const first = api.request('/ad');
  const duplicate = api.request('/ad');
  assert.equal(requests.length, 1);
  requests[0].success({ statusCode: 200, data: { enabled: true } });
  assert.deepEqual(await first, { enabled: true });
  assert.deepEqual(await duplicate, { enabled: true });

  const firstPage = api.requestPage('/bookings', { page: 1, limit: 20 });
  assert.match(requests[1].url, /\/bookings\?page=1&limit=20$/);
  requests[1].success({
    statusCode: 200,
    data: Array.from({ length: 20 }, (_, id) => ({ id })),
    header: { 'X-Total-Count': '25' }
  });
  const firstResult = await firstPage;
  assert.equal(firstResult.items.length, 20);
  assert.equal(firstResult.hasMore, true);

  const secondPage = api.requestPage('/bookings', { page: 2, limit: 20 });
  requests[2].success({
    statusCode: 200,
    data: Array.from({ length: 5 }, (_, id) => ({ id: id + 20 })),
    header: { 'x-total-count': '25' }
  });
  const secondResult = await secondPage;
  assert.equal(secondResult.items.length, 5);
  assert.equal(secondResult.hasMore, false);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
