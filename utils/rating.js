const ratingDisplay = (rating, reviewCount) => {
  const value = Number(rating);
  const count = Number(reviewCount);
  const hasRating = count > 0 && Number.isFinite(value) && value > 0;
  return {
    hasRating,
    ratingText: hasRating ? String(Number(value.toFixed(2))) : '暂无评分'
  };
};

module.exports = { ratingDisplay };
