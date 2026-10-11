const STAFF_ROLE_LABELS = Object.freeze({
  junior_barber: '初级理发师',
  intermediate_barber: '中级理发师',
  senior_barber: '高级理发师',
  chief_stylist: '首席发型师',
  creative_director: '创意总监',
  store_manager: '店长',
  principal: '主理人',
  designer: '设计师',
  senior_designer: '资深设计师',
  technical_director: '技术总监',
  art_director: '艺术总监',
  technical_store_manager: '技术店长'
});

const staffRoleLabel = roleId => STAFF_ROLE_LABELS[roleId] || '';

module.exports = { STAFF_ROLE_LABELS, staffRoleLabel };
