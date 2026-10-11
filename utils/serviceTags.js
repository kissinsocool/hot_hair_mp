const SERVICE_TAG_LABELS = Object.freeze({
  wash_cut_blow: '洗剪吹',
  color: '染发',
  perm: '烫发',
  care: '护理',
  styling: '发型设计',
  scalp_care: '头皮护理',
  men: '男士',
  women: '女士',
  straight: '直发',
  curly: '卷发',
  nutrition: '营养'
});

function serviceTagLabels(tagIds) {
  return Array.isArray(tagIds) ? tagIds.map((id) => SERVICE_TAG_LABELS[id]).filter(Boolean) : [];
}

module.exports = { SERVICE_TAG_LABELS, serviceTagLabels };
