const PROMOTION_CATEGORIES = Object.freeze([
  { id: 'women-cut', label: '女士精剪', image: '/assets/images/categories/menu.jpg' },
  { id: 'men-cut', label: '男士精剪', image: '/assets/images/categories/mens.jpg' },
  { id: 'color', label: '染发', image: '/assets/images/categories/price.jpg' },
  { id: 'curly', label: '卷发', image: '/assets/images/categories/hair-set.jpg' },
  { id: 'straight', label: '直发', image: '/assets/images/categories/counseling.jpg' },
  { id: 'care', label: '发质改善', image: '/assets/images/categories/hair-care.jpg' }
]);

function promotionCategory(id) {
  return PROMOTION_CATEGORIES.find((category) => category.id === id);
}

module.exports = { PROMOTION_CATEGORIES, promotionCategory };
