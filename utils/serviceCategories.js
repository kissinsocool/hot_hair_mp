const SERVICE_TABS = [
  { id: 'cut', label: '剪发' },
  { id: 'colorPerm', label: '染烫' },
  { id: 'scalpCare', label: '头皮护理' }
];

function serviceCategory(service = {}) {
  const tagIds = Array.isArray(service.tagIds) ? service.tagIds : [];
  if (tagIds.some((id) => id === 'color' || id === 'perm')) return 'colorPerm';
  if (tagIds.some((id) => id === 'scalp_care' || id === 'care' || id === 'nutrition')) return 'scalpCare';
  return 'cut';
}

function serviceMatchesCategory(service, category) {
  if (category === 'scalpCare') {
    const tagIds = Array.isArray(service.tagIds) ? service.tagIds : [];
    return tagIds.some((id) => id === 'scalp_care' || id === 'care' || id === 'nutrition');
  }
  return serviceCategory(service) === category;
}

module.exports = {
  SERVICE_TABS,
  serviceCategory,
  serviceMatchesCategory
};
