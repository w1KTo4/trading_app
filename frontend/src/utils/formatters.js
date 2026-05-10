const formatterCache = new Map();

const getUsdFormatter = (digits) => {
  const normalizedDigits = Number.isInteger(digits) ? Math.max(0, Math.min(8, digits)) : 2;
  const cacheKey = String(normalizedDigits);
  if (!formatterCache.has(cacheKey)) {
    formatterCache.set(
      cacheKey,
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
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
    return getUsdFormatter(digits).format(0);
  }
  return getUsdFormatter(digits).format(numeric);
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
    case 'TWELVE_DATA':
      return 'Twelve Data';
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
