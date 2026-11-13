const assert = require('node:assert/strict');
const test = require('node:test');

const calls = [];
let sizes = {};
let info = { width: 4000, height: 3000, orientation: 'up' };
global.wx = {
  compressImage(options) {
    calls.push(options);
    const name = options.compressedWidth ? `w${options.compressedWidth}` : 'q';
    options.success({ tempFilePath: name });
  },
  getImageInfo({ success }) { success(info); }
};
const fs = { statSync: (path) => ({ size: sizes[path] }) };
const { shrinkImage, resizeOptions, MAX_IMAGE_BYTES } = require('../pages/review-editor/reviewImages');

test('quality-only compression is used when it is small enough', async () => {
  calls.length = 0;
  sizes = { q: 500 * 1024 };
  assert.deepEqual(await shrinkImage('orig', fs), { path: 'q', size: 500 * 1024 });
  assert.equal(calls.length, 1);
});

test('oversized images are resized by the long edge before giving up', async () => {
  calls.length = 0;
  sizes = { q: 2 * 1024 * 1024, w1600: MAX_IMAGE_BYTES + 1, w1200: 600 * 1024 };
  assert.deepEqual(await shrinkImage('orig', fs), { path: 'w1200', size: 600 * 1024 });
  assert.deepEqual(calls.map((c) => c.compressedWidth), [undefined, 1600, 1200]);
  assert.ok(calls.every((c) => c.src === 'orig'), 'each attempt starts from the original, not a recompressed copy');

  sizes = { q: 2e6, w1600: 2e6, w1200: 2e6 };
  assert.equal(await shrinkImage('orig', fs), null);
});

test('resize keeps aspect ratio, honours EXIF rotation and never upscales', () => {
  assert.deepEqual(resizeOptions({ width: 4000, height: 3000 }, 1600), { compressedWidth: 1600 });
  assert.deepEqual(resizeOptions({ width: 3000, height: 4000 }, 1600), { compressedWidth: 1200 });
  // 原始像素横向、显示为竖向的照片：按显示方向计算宽度。
  assert.deepEqual(resizeOptions({ width: 4000, height: 3000, orientation: 'right' }, 1600), { compressedWidth: 1200 });
  assert.equal(resizeOptions({ width: 1000, height: 800 }, 1600), null);
  assert.equal(resizeOptions(null, 1600), null);
});
