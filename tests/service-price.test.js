const assert = require('node:assert/strict');
const test = require('node:test');
const { servicePriceDisplay } = require('../utils/money');

test('original 280 at 9折 displays original 280 and the canonical selling price 252', () => {
  assert.deepEqual(servicePriceDisplay(25200, 90, 28000), {
    priceText: '¥252', discountText: '-10%', originalPriceText: '¥280'
  });
  assert.deepEqual(servicePriceDisplay(200, 1, 19950), {
    priceText: '¥2', discountText: '-99%', originalPriceText: '¥199.50'
  });
  assert.equal(servicePriceDisplay(28000, 90).originalPriceText, '');
});

test('old packages, cleared discount, full price, and free services do not show savings', () => {
  for (const discount of [undefined, null, 0, 100, -1, 101, 65.5, '65']) {
    assert.deepEqual(servicePriceDisplay(8000, discount), {
      priceText: '¥80', discountText: '', originalPriceText: ''
    });
  }
  assert.equal(servicePriceDisplay(0, 60).originalPriceText, '');
});

test('price component recomputes when a price or discount is changed or cleared', () => {
  let definition;
  global.Component = value => { definition = value; };
  require('../components/service-price/service-price');
  const state = { setData(data) { this.data = data; } };
  const update = definition.observers['priceFen, discountTenths, originalPriceFen'];
  update.call(state, 8000, 80, 10000);
  assert.equal(state.data.originalPriceText, '¥100');
  update.call(state, 10000, 80, 12500);
  assert.equal(state.data.originalPriceText, '¥125');
  update.call(state, 10000, 0, 10000);
  assert.equal(state.data.discountText, '');
  assert.equal(state.data.originalPriceText, '');
});
