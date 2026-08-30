const REVIEW_TAGS = ['善于沟通', '环境舒适', '技术一流', '服务周到'];

const buildReviewTags = (selected = []) => REVIEW_TAGS.map((name) => ({
  name,
  selected: selected.includes(name)
}));

const toggleReviewTag = (tags, name) => tags.map((tag) => (
  tag.name === name ? { ...tag, selected: !tag.selected } : tag
));

const selectedReviewTags = (tags) => tags.filter((tag) => tag.selected).map((tag) => tag.name);

module.exports = { buildReviewTags, selectedReviewTags, toggleReviewTag };
