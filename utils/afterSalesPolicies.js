const AFTER_SALES_POLICY_LABELS = Object.freeze({
  haircut_7_day_adjustment: '剪发七日内不满意免费重新调整',
  color_perm_15_day_redo: '染烫十五日内不满意免费重做'
});

function afterSalesPolicyLabels(policyIds) {
  return Array.isArray(policyIds)
    ? [...new Set(policyIds)].map((id) => AFTER_SALES_POLICY_LABELS[id]).filter(Boolean)
    : [];
}

module.exports = { AFTER_SALES_POLICY_LABELS, afterSalesPolicyLabels };
