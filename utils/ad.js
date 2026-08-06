const api = require('./api');

const DEFAULT = {
  enabled: false,
  image: '',
  link: '/pages/ad/ad'
};

async function load() {
  try {
    const config = await api.request('/ad');
    return {
      enabled: config.enabled !== false,
      image: config.imageUrl ? await api.displayImageUrl(config.imageUrl) : DEFAULT.image,
      link: String(config.link || '').startsWith('/pages/') ? config.link : DEFAULT.link
    };
  } catch (_) {
    return { ...DEFAULT };
  }
}

module.exports = { DEFAULT, load };
