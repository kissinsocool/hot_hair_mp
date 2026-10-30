const api = require('./api');
const CACHE_MS = 5 * 60 * 1000;
let cached;

async function loadPromotionImage() {
  const session = api.session();
  const authenticated = Boolean(session && session.token);
  const key = authenticated ? `authenticated:${session.token}` : 'anonymous';
  if (cached && cached.key === key && cached.expiresAt > Date.now()) return cached.image;
  const gift = await api.request(authenticated ? '/auth/coupon-campaign' : '/coupon-campaign');
  const image = gift.enabled && gift.promotionImageUrl
    ? await api.displayImageUrl(gift.promotionImageUrl, 960)
    : '';
  cached = { key, image, expiresAt: Date.now() + CACHE_MS };
  return image;
}

async function claim() {
  await api.request('/auth/coupon-campaign/claim', { method: 'POST' });
  cached = null;
}

module.exports = { loadPromotionImage, claim };
