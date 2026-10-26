function formatFenAmount(value) {
  const fen = Number(value || 0);
  const amount = Number.isFinite(fen) ? fen / 100 : 0;
  const decimals = Number.isInteger(amount) ? 0 : 2;
  const [integer, fraction] = amount.toFixed(decimals).split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}

function formatFen(value) {
  return `¥${formatFenAmount(value)}`;
}

function servicePriceDisplay(priceFen, discountTenths, originalPriceFen) {
  const hasDiscount = Number.isSafeInteger(priceFen) && priceFen > 0
    && Number.isSafeInteger(originalPriceFen) && originalPriceFen > priceFen
    && Number.isInteger(discountTenths) && discountTenths >= 1 && discountTenths < 100;
  return {
    priceText: formatFen(priceFen),
    discountText: hasDiscount ? `-${100 - discountTenths}%` : '',
    originalPriceText: hasDiscount ? formatFen(originalPriceFen) : ''
  };
}

module.exports = { formatFen, formatFenAmount, servicePriceDisplay };
