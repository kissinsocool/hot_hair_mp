const api = require('./api');
const CACHE_MS = 10 * 60 * 1000;
let cached;

const DEFAULT = {
  enabled: false,
  image: '',
  link: '/pages/ad/ad'
};

async function load() {
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  try {
    const config = await api.request('/ad');
    const value = {
      enabled: config.enabled !== false,
      image: config.imageUrl ? await api.displayImageUrl(config.imageUrl) : DEFAULT.image,
      link: String(config.link || '').startsWith('/pages/') ? config.link : DEFAULT.link
    };
    cached = { value, expiresAt: Date.now() + CACHE_MS };
    return value;
  } catch (_) {
    return { ...DEFAULT };
  }
}

module.exports = { DEFAULT, load };
