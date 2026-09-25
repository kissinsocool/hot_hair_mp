const api = require('./api');
const { normalizeHttpsUrl } = require('./webUrl');
const CACHE_MS = 10 * 60 * 1000;
let cached;

const DEFAULT = {
  enabled: false,
  image: '',
  link: ''
};

function navigationLink(value) {
  const link = String(value || '').trim();
  const webUrl = normalizeHttpsUrl(link);
  if (webUrl) return `/pages/web/web?url=${encodeURIComponent(webUrl)}`;
  if (link === '/pages/ad/ad') return '';
  return /^\/pages\/[A-Za-z0-9_/-]+(?:\?[^#\s]*)?$/.test(link) && !link.includes('..') ? link : '';
}

async function load() {
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  try {
    const config = await api.request('/ad');
    const link = navigationLink(config.link);
    const value = {
      enabled: config.enabled !== false && Boolean(link),
      image: config.imageUrl ? await api.displayImageUrl(config.imageUrl) : DEFAULT.image,
      link
    };
    cached = { value, expiresAt: Date.now() + CACHE_MS };
    return value;
  } catch (_) {
    return { ...DEFAULT };
  }
}

module.exports = { DEFAULT, load, navigationLink };
