const { REVIEW_RATING_FIELDS } = require('../../utils/reviewRatings.js');

Component({
  properties: { value: { type: Object, value: {} } },
  data: { fields: REVIEW_RATING_FIELDS, stars: [1, 2, 3, 4, 5] },
  methods: {
    chooseRating(e) {
      const { key, value } = e.currentTarget.dataset;
      this.triggerEvent('change', { key, value: Number(value) });
    }
  }
});
