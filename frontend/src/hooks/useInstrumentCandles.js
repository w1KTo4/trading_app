import { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { normalizeCandle, updateCandlesWithTick } from '../utils/candles';

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
    setLoading(true);

    api
      .get(`/api/instruments/${symbol}/candles?timeframe=${timeframe}&limit=${limit}`)
      .then((res) => {
        if (active) {
          const fetchedCandles = (res.data || []).map(normalizeCandle);
          const nextLivePrice = livePriceRef.current;
          setCandles(
            nextLivePrice == null
              ? fetchedCandles
              : updateCandlesWithTick(fetchedCandles, nextLivePrice, timeframe, limit),
          );
        }
      })
      .catch(() => {
        if (active) {
          setCandles([]);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
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
