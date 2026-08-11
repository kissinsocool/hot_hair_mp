const SERVICE_TABS = [
  { id: 'cut', label: '剪发' },
  { id: 'colorPerm', label: '染烫' },
  { id: 'scalpCare', label: '头皮护理' }
];

function serviceCategory(service = {}) {
  const tags = Array.isArray(service.tags)
    ? service.tags
    : Array.isArray(service.categories) ? service.categories : [];
  if (tags.some((tag) => /染发|烫发/.test(String(tag)))) return 'colorPerm';
  if (tags.some((tag) => /头皮|护理/.test(String(tag)))) return 'scalpCare';
  return 'cut';
}

function serviceMatchesCategory(service, category) {
  if (category === 'scalpCare') {
    const tags = Array.isArray(service.tags)
      ? service.tags
      : Array.isArray(service.categories) ? service.categories : [];
    return tags.some((tag) => /头皮|护理/.test(String(tag)));
  }
  return serviceCategory(service) === category;
}

module.exports = {
  SERVICE_TABS,
  serviceCategory,
  serviceMatchesCategory
};
