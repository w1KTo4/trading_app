import { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { normalizeCandle, updateCandlesWithTick } from '../utils/candles';

const MAX_BOOTSTRAP_RETRIES = 8;
const BOOTSTRAP_RETRY_DELAY_MS = 2500;

function useInstrumentCandles({ symbol, timeframe = '15m', limit = 200, livePrice = null }) {
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(false);
  const livePriceRef = useRef(livePrice);

  useEffect(() => {
    livePriceRef.current = livePrice;
  }, [livePrice]);

  useEffect(() => {
    if (!symbol) {
      setCandles([]);
      return undefined;
    }

    let active = true;
    let retryCount = 0;
    let retryTimerId = null;
    let initialRequestCompleted = false;
    const minimumExpectedCandles = Math.min(Math.max(20, Math.floor(limit * 0.35)), 80);
    setLoading(true);

    const scheduleRetry = () => {
      if (!active || retryCount >= MAX_BOOTSTRAP_RETRIES) {
        return;
      }
      retryCount += 1;
      retryTimerId = window.setTimeout(fetchCandles, BOOTSTRAP_RETRY_DELAY_MS);
    };

    const fetchCandles = () => {
      api
        .get(`/api/instruments/${symbol}/candles?timeframe=${timeframe}&limit=${limit}`)
        .then((res) => {
          if (!active) {
            return;
          }

          const fetchedCandles = (res.data || []).map(normalizeCandle);
          const nextLivePrice = livePriceRef.current;
          const nextCandles =
            nextLivePrice == null
              ? fetchedCandles
              : updateCandlesWithTick(fetchedCandles, nextLivePrice, timeframe, limit);

          setCandles(nextCandles);
          if (nextCandles.length < minimumExpectedCandles) {
            scheduleRetry();
          }
        })
        .catch(() => {
          if (!active) {
            return;
          }
          setCandles([]);
          scheduleRetry();
        })
        .finally(() => {
          if (active && !initialRequestCompleted) {
            setLoading(false);
            initialRequestCompleted = true;
          }
        });
    };

    fetchCandles();

    return () => {
      active = false;
      if (retryTimerId != null) {
        window.clearTimeout(retryTimerId);
      }
    };
  }, [limit, symbol, timeframe]);

  useEffect(() => {
    if (!symbol || livePrice == null) {
      return;
    }

    setCandles((previousCandles) => updateCandlesWithTick(previousCandles, livePrice, timeframe, limit));
  }, [limit, livePrice, symbol, timeframe]);

  return { candles, loading, setCandles };
}

export default useInstrumentCandles;
