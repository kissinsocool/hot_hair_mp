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

test('WebP is opt-in for public JPEG thumbnails and previews still open originals', async () => {
  const source = 'https://media.hothaircc.cn/uploads/photo.jpg';
  const jpeg = api.thumbnailUrl(source, 480);
  const webp = await api.displayImageUrl(source, 480, { webp: true });
  assert.equal(webp, `${jpeg}/format,webp`);
  assert.equal(api.jpegThumbnailFallback(webp), jpeg);

  const png = source.replace('.jpg', '.png');
  assert.equal(api.thumbnailUrl(png, 480, { webp: true }), api.thumbnailUrl(png, 480));
  const external = webp.replace('media.hothaircc.cn', 'example.com');
  assert.equal(api.jpegThumbnailFallback(external), external);
  const signed = `${webp}&Signature=opaque`;
  assert.equal(api.thumbnailUrl(signed, 480, { webp: true }), signed);
  assert.equal(api.jpegThumbnailFallback(signed), signed);
  api.previewImage({ urls: [jpeg, webp, signed, external], current: webp });
  assert.deepEqual(previews.pop(), { urls: [source, source, signed, external], current: source });
});

test('home requests WebP covers and retries the matching card once with its JPEG thumbnail', async () => {
  let home;
  global.Page = (page) => { home = page; };
  require('../pages/home/home');
  const source = 'https://media.hothaircc.cn/uploads/home.jpg';
  const [salon] = await home.normalizeSalonPage.call({ ...home, data: home.data }, [{ id: 'home-salon', image: source }]);
  const jpeg = api.thumbnailUrl(source, 480);
  const [image] = salon.cardImages;
  assert.equal(image, `${jpeg}/format,webp`);
  assert.equal(salon.cardImages.length, 1);

  const page = {
    data: { salonCards: [{ images: ['other', image] }] },
    setData(updates) {
      assert.deepEqual(updates, { 'salonCards[0].images[1]': jpeg });
      this.data.salonCards[0].images[1] = jpeg;
      this.retries = (this.retries || 0) + 1;
    }
  };
  const error = (src) => home.onSalonImageError.call(page, { currentTarget: { dataset: { cardIndex: 0, imageIndex: 1, src } } });
  error(image.replace('home.jpg', 'previous.jpg'));
  assert.equal(page.retries, undefined);
  error(image);
  error(image);
  error(jpeg);
  assert.equal(page.retries, 1);
});

test('signed, animated, external and local images keep their URLs', () => {
  assert.equal(api.thumbnailUrl('https://media.hothaircc.cn/uploads/photo.jpg?token=abc', 480),
    'https://media.hothaircc.cn/uploads/photo.jpg?token=abc');
  assert.equal(api.thumbnailUrl('https://media.hothaircc.cn/uploads/animated.gif', 480),
    'https://media.hothaircc.cn/uploads/animated.gif');
  assert.equal(api.thumbnailUrl('https://example.com/photo.jpg', 480), 'https://example.com/photo.jpg');
  assert.equal(api.thumbnailUrl('wxfile://photo.jpg', 480), 'wxfile://photo.jpg');
});

test('OSS signatures and encoded object paths are preserved byte for byte', () => {
  const signed = 'https://hothairprivate.oss-cn-beijing.aliyuncs.com/moderation/%E5%9B%BE.jpg?OSSAccessKeyId=dummy&Signature=abc%2Fdef%2Bghi%3D&Expires=2000000000';
  assert.equal(api.thumbnailUrl(signed, 360), signed);
  assert.equal(api.mediaUrl(signed), signed);
  const publicSigned = signed.replace('hothairprivate', 'hothairmedia');
  assert.equal(api.thumbnailUrl(publicSigned, 360), publicSigned, 'signed origins must not be rewritten either');
});
