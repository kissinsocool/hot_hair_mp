// 评价、投诉图片的上传前处理。上传签名接口限制单张 800KB。
const MAX_IMAGE_BYTES = 800 * 1024;
// 先只降质量；仍超限时依次把长边缩到这些尺寸再压缩，避免手机原图直接被拒、只能让用户换图。
const RESIZE_LONG_EDGES = [1600, 1200];
const QUALITY = 35;

function compressImage(src, options = {}) {
  return new Promise((resolve) => {
    if (!wx.compressImage) return resolve(src);
    wx.compressImage({
      src,
      quality: QUALITY,
      ...options,
      success: (res) => resolve(res.tempFilePath || src),
      fail: () => resolve(src)
    });
  });
}

function imageInfo(src) {
  return new Promise((resolve) => {
    if (!wx.getImageInfo) return resolve(null);
    wx.getImageInfo({ src, success: resolve, fail: () => resolve(null) });
  });
}

// 按显示方向的长边等比缩小，只传宽度让高度按比例计算；不放大原图。
// EXIF 旋转 90° 的照片（orientation 为 left/right 系列）原始宽高与显示方向相反。
function resizeOptions(info, longEdge) {
  if (!info || !(info.width > 0) || !(info.height > 0)) return null;
  const rotated = /^(left|right)/.test(String(info.orientation || ''));
  const width = rotated ? info.height : info.width;
  const height = rotated ? info.width : info.height;
  const scale = longEdge / Math.max(width, height);
  if (scale >= 1) return null;
  return { compressedWidth: Math.round(width * scale) };
}

function fileSize(fs, path) {
  try {
    return fs.statSync(path).size;
  } catch (_) {
    return 0;
  }
}

// 返回处理后的临时路径和大小；无法压到限制以内时返回 null。
async function shrinkImage(src, fs = wx.getFileSystemManager()) {
  let path = await compressImage(src);
  let size = fileSize(fs, path);
  if (size && size <= MAX_IMAGE_BYTES) return { path, size };
  const info = await imageInfo(src);
  for (const longEdge of RESIZE_LONG_EDGES) {
    const options = resizeOptions(info, longEdge);
    if (!options) continue;
    path = await compressImage(src, options);
    size = fileSize(fs, path);
    if (size && size <= MAX_IMAGE_BYTES) return { path, size };
  }
  return null;
}

module.exports = { shrinkImage, resizeOptions, MAX_IMAGE_BYTES };
