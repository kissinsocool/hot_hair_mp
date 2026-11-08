const assert = require('node:assert/strict');

let now = 1000;
let session = { token: 'A' };
const requests = [];
Date.now = () => now;
global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api', get session() { return session; } } });
global.wx = { getStorageSync: () => null };
const api = require('../utils/api');
api.request = async (path) => { requests.push(path); return { id: path, services: [{ id: 's', name: `v${requests.length}` }] }; };
const salonDetail = require('../utils/salonDetail');

(async () => {
  const fresh = await salonDetail.load('salon-1', { maxAgeMs: 0 });
  assert.deepEqual(requests, ['/salons/salon-1']);
  const reused = await salonDetail.load('salon-1');
  assert.equal(requests.length, 1, '详情页刚拉取的数据，预约页直接复用');
  assert.deepEqual(reused, fresh);
  reused.services[0].name = '被页面修改';
  assert.equal((await salonDetail.load('salon-1')).services[0].name, 'v1', '返回副本，页面修改不污染缓存');

  await salonDetail.load('salon-1', { maxAgeMs: 0 });
  assert.equal(requests.length, 2, '详情页每次都读取最新数据');

  now += salonDetail.CACHE_MS;
  await salonDetail.load('salon-1');
  assert.equal(requests.length, 3, '超过缓存时间重新读取');

  session = { token: 'B' };
  await salonDetail.load('salon-1');
  assert.equal(requests.length, 4, '不同账号不共享缓存');

  for (let index = 0; index < 25; index += 1) await salonDetail.load(`other-${index}`);
  const before = requests.length;
  await salonDetail.load('salon-1');
  assert.equal(requests.length, before + 1, '缓存条目有上限，最早的条目被淘汰');

  api.request = async () => { throw new Error('网络错误'); };
  await assert.rejects(salonDetail.load('fail-1'));
  api.request = async (path) => ({ id: path });
  assert.deepEqual(await salonDetail.load('fail-1'), { id: '/salons/fail-1' }, '失败结果不缓存');
})().catch((error) => { console.error(error); process.exitCode = 1; });
