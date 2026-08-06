const assert = require('node:assert/strict');

let definition;
global.Component = (options) => { definition = options; };
global.getCurrentPages = () => [{ route: 'pages/favorites/favorites' }];

require('../custom-tab-bar/index');

const component = {
  data: { ...definition.data, list: definition.data.list.map((item) => ({ ...item })) },
  setData(values) { Object.assign(this.data, values); },
  syncSelected: definition.methods.syncSelected,
  select: definition.methods.select
};
definition.lifetimes.attached.call(component);

assert.equal(component.data.initialized, true);
assert.equal(component.data.selected, 1);
assert.deepEqual(component.data.list.map((item) => Boolean(item.selected)), [false, true, false, false]);

delete global.Component;
delete global.getCurrentPages;
