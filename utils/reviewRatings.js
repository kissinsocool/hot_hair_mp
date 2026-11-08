const REVIEW_RATING_FIELDS = [
  { key: 'environment', label: '店内环境' },
  { key: 'service', label: '接待服务' },
  { key: 'technique', label: '技术·完成效果' },
  { key: 'price', label: '套餐价格' }
];

function reviewRatingAverage(ratings) {
  const values = REVIEW_RATING_FIELDS.map(({ key }) => ratings[key]);
  if (!values.every(value => Number.isInteger(value) && value >= 1 && value <= 5)) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

module.exports = { REVIEW_RATING_FIELDS, reviewRatingAverage };
