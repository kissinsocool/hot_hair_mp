const assert = require('node:assert/strict');

let definition;
global.Component = (options) => { definition = options; };
global.getCurrentPages = () => [{ route: 'pages/favorites/favorites' }];

require('../custom-tab-bar/index');

const component = {
  data: { ...definition.data, list: definition.data.list.map((item) => ({ ...item })) },
  setData(values) { Object.assign(this.data, values); },
  syncSelected: definition.methods.syncSelected,
  select: definition.methods.select,
  hide: definition.methods.hide,
  show: definition.methods.show
};
definition.lifetimes.attached.call(component);

assert.equal(component.data.initialized, true);
assert.equal(component.data.selected, 1);
assert.deepEqual(component.data.list.map((item) => Boolean(item.selected)), [false, true, false, false]);

component.hide();
definition.pageLifetimes.show.call(component);
assert.equal(component.data.hidden, true, 'returning from the media picker must not reveal a hidden tab bar');
component.show();
assert.equal(component.data.hidden, false, 'an explicit page show must reveal the tab bar');

delete global.Component;
delete global.getCurrentPages;
