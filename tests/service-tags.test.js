const assert = require('node:assert/strict');
const { serviceTagLabels } = require('../utils/serviceTags');

assert.deepEqual(serviceTagLabels(['wash_blow']), ['洗吹']);
assert.deepEqual(serviceTagLabels(['wash_cut_blow', 'wash_blow']), ['洗剪吹', '洗吹']);
assert.deepEqual(serviceTagLabels(['unknown', 'wash_blow']), ['洗吹']);
