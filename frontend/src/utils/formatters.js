const formatterCache = new Map();

const getCurrencyFormatter = (currency, locale, digits) => {
  const normalizedDigits = Number.isInteger(digits) ? Math.max(0, Math.min(8, digits)) : 2;
  const cacheKey = `${locale}:${currency}:${normalizedDigits}`;
  if (!formatterCache.has(cacheKey)) {
    formatterCache.set(
      cacheKey,
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: normalizedDigits,
        maximumFractionDigits: normalizedDigits,
      }),
    );
  }
  return formatterCache.get(cacheKey);
};

export const formatUsd = (value, digits = 2) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return getCurrencyFormatter('USD', 'en-US', digits).format(0);
  }
  return getCurrencyFormatter('USD', 'en-US', digits).format(numeric);
};

export const formatPln = (value, digits = 2) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return getCurrencyFormatter('PLN', 'pl-PL', digits).format(0);
  }
  return getCurrencyFormatter('PLN', 'pl-PL', digits).format(numeric);
};

export const formatPercent = (value, digits = 2) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '0.00%';
  }
  return `${numeric.toFixed(digits)}%`;
};

export const formatPriceSource = (source, connected = false) => {
  const normalized = String(source || '').trim().toUpperCase();

  switch (normalized) {
    case 'BINANCE_REST':
      return 'Binance (delayed)';
    case 'BINANCE':
      return 'Binance';
    case 'SIMULATOR':
      return 'Simulator';
    case 'DB':
      return 'Database snapshot';
    case 'MARKET SNAPSHOT':
      return 'Live snapshot';
    case 'SNAPSHOT':
      return connected ? 'Live snapshot' : 'Snapshot';
    default:
      return normalized || (connected ? 'Live snapshot' : 'Snapshot');
  }
};
