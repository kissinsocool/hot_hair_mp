const assert = require('node:assert/strict');
const { test } = require('node:test');

const previews = [];
global.getApp = () => ({ globalData: {
  apiBaseUrl: 'https://api.hothaircc.cn/api',
  mediaBaseUrl: 'https://media.hothaircc.cn'
} });
global.wx = { previewImage: (options) => previews.push(options) };

const api = require('../utils/api');

test('public OSS images use small variants and previews use originals', async () => {
  const source = 'https://hothairmedia.oss-cn-beijing.aliyuncs.com/uploads/photo.jpg';
  const thumbnail = await api.displayImageUrl(source, 480);
  assert.equal(thumbnail, 'https://media.hothaircc.cn/uploads/photo.jpg?x-oss-process=image/resize,w_480/quality,q_75');
  api.previewImage({ urls: [thumbnail], current: thumbnail });
  assert.deepEqual(previews.pop(), {
    urls: ['https://media.hothaircc.cn/uploads/photo.jpg'],
    current: 'https://media.hothaircc.cn/uploads/photo.jpg'
  });
});

test('signed, animated, external and local images keep their URLs', () => {
  assert.equal(api.thumbnailUrl('https://media.hothaircc.cn/uploads/photo.jpg?token=abc', 480),
    'https://media.hothaircc.cn/uploads/photo.jpg?token=abc');
  assert.equal(api.thumbnailUrl('https://media.hothaircc.cn/uploads/animated.gif', 480),
    'https://media.hothaircc.cn/uploads/animated.gif');
  assert.equal(api.thumbnailUrl('https://example.com/photo.jpg', 480), 'https://example.com/photo.jpg');
  assert.equal(api.thumbnailUrl('wxfile://photo.jpg', 480), 'wxfile://photo.jpg');
});
