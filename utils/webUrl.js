const HTTPS_URL_PATTERN = /^https:\/\/[^@/\s?#]+(?:[/?#][^\s]*)?$/i;

function normalizeHttpsUrl(value) {
  const url = String(value || '').trim();
  return url.length <= 2048 && HTTPS_URL_PATTERN.test(url) ? url : '';
}

module.exports = { normalizeHttpsUrl };
