const api = require('./api');

// WebP 缩略图加载失败时（个别机型不支持，或图片处理服务出错），把这一张换回同尺寸的 JPEG 缩略图，只重试一次。
// 模板在 <image> 上传入 data-path（这张图在页面 data 中的 setData 路径）和 data-src（当前地址），
// binderror 调用本函数。
function retryAsJpeg(page, e) {
  const { path, src } = (e && e.currentTarget && e.currentTarget.dataset) || {};
  if (typeof path !== 'string' || !path || typeof src !== 'string') return;
  // 列表已刷新、这个位置换成了别的图片时，忽略迟到的失败事件。
  if (readPath(page.data, path) !== src) return;
  const fallback = api.jpegThumbnailFallback(src);
  if (fallback !== src) page.setData({ [path]: fallback });
}

function readPath(data, path) {
  return (path.match(/[^.[\]]+/g) || []).reduce((node, key) => (node == null ? undefined : node[key]), data);
}

module.exports = { retryAsJpeg };
