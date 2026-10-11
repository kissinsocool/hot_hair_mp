const AFTER_SALES_POLICY_LABELS = Object.freeze({
  haircut_7_day_adjustment: '剪发七日内不满意可重新调整',
  color_perm_15_day_redo: '染烫十五日内不满意免费重做',
  no_active_sales: '不主动推销',
  unsatisfied_no_charge: '不满意免单',
  no_hidden_charges: '无隐形消费'
});

function afterSalesPolicyLabels(policyIds) {
  return Array.isArray(policyIds)
    ? [...new Set(policyIds)].map((id) => AFTER_SALES_POLICY_LABELS[id]).filter(Boolean)
    : [];
}

module.exports = { AFTER_SALES_POLICY_LABELS, afterSalesPolicyLabels };
