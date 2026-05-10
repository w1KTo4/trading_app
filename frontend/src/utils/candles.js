export const TIMEFRAME_MS = {
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
};

export const normalizeCandle = (candle) => ({
  time: candle.time,
  open: Number(candle.open),
  high: Number(candle.high),
  low: Number(candle.low),
  close: Number(candle.close),
});

export const updateCandlesWithTick = (previousCandles, nextPrice, timeframe, limit) => {
  const frameMs = TIMEFRAME_MS[timeframe] || TIMEFRAME_MS['15m'];
  const nowMs = Date.now();
  const bucketMs = Math.floor(nowMs / frameMs) * frameMs;
  const bucketIso = new Date(bucketMs).toISOString();
  const price = Number(nextPrice);

  if (Number.isNaN(price)) {
    return previousCandles;
  }

  if (previousCandles.length === 0) {
    return [{ time: bucketIso, open: price, high: price, low: price, close: price }];
  }

  const next = [...previousCandles];
  const last = next[next.length - 1];
  const lastBucket = Math.floor(new Date(last.time).getTime() / frameMs) * frameMs;

  if (lastBucket === bucketMs) {
    next[next.length - 1] = {
      ...last,
      high: Math.max(Number(last.high), price),
      low: Math.min(Number(last.low), price),
      close: price,
    };
    return next;
  }

  next.push({ time: bucketIso, open: price, high: price, low: price, close: price });
  if (next.length > limit) {
    return next.slice(next.length - limit);
  }
  return next;
};
