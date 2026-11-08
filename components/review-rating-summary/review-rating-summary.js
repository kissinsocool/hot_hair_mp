const { REVIEW_RATING_FIELDS, reviewRatingAverage } = require('../../utils/reviewRatings.js');

Component({
  properties: {
    rating: { type: Number, value: 0 },
    ratings: { type: Object, value: null }
  },
  data: { ratingText: '暂无评分', stars: [], fields: [] },
  observers: {
    'rating, ratings'(rating, ratings) {
      const hasRating = Number.isFinite(rating) && rating >= 1 && rating <= 5;
      this.setData({
        ratingText: hasRating ? String(Number(rating.toFixed(2))) : '暂无评分',
        stars: hasRating ? [0, 1, 2, 3, 4].map(index => ({
          index, fill: Math.max(0, Math.min(1, rating - index)) * 100
        })) : [],
        fields: ratings && reviewRatingAverage(ratings)
          ? REVIEW_RATING_FIELDS.map(field => ({ ...field, score: ratings[field.key] })) : []
      });
    }
  }
});
