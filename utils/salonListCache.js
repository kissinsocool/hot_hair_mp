// 首页附近店铺第一页的本地缓存：冷启动时先展示上次的列表，不必等列表接口返回才有内容，
// 随后的实时请求结果会整体替换它。只缓存默认视图（未搜索、按距离排序），并与请求时的位置绑定，
// 位置不同（如用户手动选点）时不使用。
const STORAGE_KEY = 'homeSalonListCache';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function sameLocation(a, b) {
  return Boolean(a && b) && a.latitude === b.latitude && a.longitude === b.longitude;
}

function read(location) {
  let cached;
  try {
    cached = wx.getStorageSync(STORAGE_KEY);
  } catch (_) {
    return null;
  }
  if (!cached || !Array.isArray(cached.items) || !cached.items.length) return null;
  if (!sameLocation(cached.location, location)) return null;
  if (!(Date.now() - cached.savedAt < MAX_AGE_MS)) return null;
  return cached.items;
}

// 缓存只是加速首屏的辅助数据，写入失败不能影响列表本身。
function save(location, items) {
  if (!location || !Array.isArray(items)) return;
  try {
    wx.setStorage({
      key: STORAGE_KEY,
      data: {
        location: { latitude: location.latitude, longitude: location.longitude },
        items,
        savedAt: Date.now()
      },
      fail() {}
    });
  } catch (_) {}
}

module.exports = { read, save, STORAGE_KEY, MAX_AGE_MS };
