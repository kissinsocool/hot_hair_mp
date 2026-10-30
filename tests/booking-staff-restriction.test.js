const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
global.getApp = () => ({ globalData: {} });
let definition;
global.Page = page => { definition = page; };
require('../pages/booking/booking');
const api = require('../utils/api');
const analytics = require('../utils/analytics');
analytics.track = () => Promise.resolve();
api.thumbnailUrl = url => url;
api.request = async () => ({
  staff: [{ id: 'staff-1', name: 'Tony', extraServiceFeeFen: 2000 }],
  services: [
    { id: 'restricted', name: '限定套餐', tagIds: ['wash_cut_blow'], priceFen: 8000, staffSelectionRestricted: true },
    { id: 'normal', name: '普通套餐', tagIds: ['wash_cut_blow'], priceFen: 8000 }
  ]
});
function page() {
  return {
    ...definition,
    salonId: 'salon-1',
    data: structuredClone(definition.data),
    setData(values) { Object.assign(this.data, values); },
    loadSlots() { this.slotStaffId = this.data.selectedStaffId; this.slotLoads = (this.slotLoads || 0) + 1; }
  };
}
const event = id => ({ currentTarget: { dataset: { id } } });

test('shared restricted package overrides initial staff and disables other options', async () => {
  const p = page();
  p.initialStaffId = 'staff-1';
  p.initialServiceId = 'restricted';
  await p.load();
  assert.equal(p.data.selectedStaffId, '__no_preference__');
  assert.equal(p.slotStaffId, '__no_preference__');
  assert.equal(p.data.staffOptions[0].className, 'active');
  assert.equal(p.data.staffOptions[0].disabled, false);
  assert.equal(p.data.staffOptions[1].className, 'disabled');
  assert.equal(p.data.staffOptions[1].disabled, true);
  const loads = p.slotLoads;
  p.selectStaff(event('staff-1'));
  assert.equal(p.data.selectedStaffId, '__no_preference__');
  assert.equal(p.slotLoads, loads);
});

test('switching packages clears a chosen staff, normal packages and category clearing re-enable staff', async () => {
  const p = page();
  await p.load();
  p.selectService(event('normal'));
  p.selectStaff(event('staff-1'));
  assert.equal(p.data.selectedStaffId, 'staff-1');
  p.selectService(event('restricted'));
  assert.equal(p.data.selectedStaffId, '__no_preference__');
  assert.equal(p.slotStaffId, '__no_preference__');
  p.selectService(event('normal'));
  assert.equal(p.data.staffOptions[1].disabled, false);
  p.selectStaff(event('staff-1'));
  assert.equal(p.data.selectedStaffId, 'staff-1');
  p.selectService(event('restricted'));
  p.selectServiceCategory({ currentTarget: { dataset: { category: 'colorPerm' } } });
  p.refreshOptions();
  assert.equal(p.data.selectedServiceId, '');
  assert.equal(p.data.staffOptions[1].disabled, false);
});

test('disabled staff styling and accessible disabled state are rendered', () => {
  const base = path.join(__dirname, '../pages/booking');
  assert.match(fs.readFileSync(path.join(base, 'booking.wxml'), 'utf8'), /aria-disabled="{{item.disabled}}"/);
  assert.match(fs.readFileSync(path.join(base, 'booking.wxss'), 'utf8'), /\.staff-option\.disabled\s*\{[^}]*opacity: 0\.4/);
});


test('restricted packages allow multiple selected staff while blocking the rest', async () => {
  const p = page();
  await p.load();
  p.data.salon.staff.push({ id: 'staff-2', name: 'Lee' }, { id: 'staff-3', name: 'Sam' });
  p.data.salon.services[0].selectableStaffIds = ['staff-1', 'staff-2'];
  p.selectService(event('restricted'));
  assert.equal(p.data.selectedStaffId, '__no_preference__');
  assert.equal(p.data.staffOptions[1].disabled, false);
  assert.equal(p.data.staffOptions[2].disabled, false);
  assert.equal(p.data.staffOptions[3].disabled, true);
  p.selectStaff(event('staff-1'));
  p.refreshOptions();
  assert.equal(p.data.selectedStaffId, 'staff-1');
  assert.equal(p.data.staffOptions[1].className, 'active');
  p.selectStaff(event('staff-2'));
  p.refreshOptions();
  assert.equal(p.data.selectedStaffId, 'staff-2');
  const loads = p.slotLoads;
  p.selectStaff(event('staff-3'));
  assert.equal(p.data.selectedStaffId, 'staff-2');
  assert.equal(p.slotLoads, loads);
  p.data.salon.services[0].selectableStaffIds = ['staff-1'];
  p.refreshOptions();
  assert.equal(p.data.selectedStaffId, '__no_preference__');
  p.selectService(event('normal'));
  assert.equal(p.data.staffOptions[3].disabled, false);
});

test('a share link retains an allowed staff selection', async () => {
  const p = page();
  p.initialServiceId = 'restricted';
  p.initialStaffId = 'staff-1';
  const request = api.request;
  api.request = async () => {
    const salon = await request();
    salon.services[0].selectableStaffIds = ['staff-1'];
    return salon;
  };
  try {
    await p.load();
    assert.equal(p.data.selectedStaffId, 'staff-1');
    assert.equal(p.slotStaffId, 'staff-1');
  } finally { api.request = request; }
});
