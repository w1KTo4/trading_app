import { useEffect, useMemo, useRef } from 'react';
import { createChart, CrosshairMode, CandlestickSeries } from 'lightweight-charts';

const toFallbackCandles = (points = []) =>
  points
    .map((point) => {
      const price = Number(point?.price);
      const time = point?.ts;
      if (!time || Number.isNaN(price)) {
        return null;
      }
      return { time, open: price, high: price, low: price, close: price };
    })
    .filter(Boolean);

const toUnixTime = (time) => {
  const parsed = new Date(time).getTime();
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.floor(parsed / 1000);
};

function Chart({ candles = [], points = [], symbol = 'N/A', timeframe = '15m', embedded = false }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const fitDoneRef = useRef(false);

  const preparedCandles = useMemo(() => {
    const normalized = (candles.length > 0 ? candles : toFallbackCandles(points))
      .map((candle) => {
        const unix = toUnixTime(candle.time);
        if (!unix) {
          return null;
        }
        return {
          time: unix,
          open: Number(candle.open),
          high: Number(candle.high),
          low: Number(candle.low),
          close: Number(candle.close),
        };
      })
      .filter(Boolean)
      .filter(
        (candle) =>
          Number.isFinite(candle.open) &&
          Number.isFinite(candle.high) &&
          Number.isFinite(candle.low) &&
          Number.isFinite(candle.close),
      );

    return normalized;
  }, [candles, points]);

  const visibleBars = useMemo(() => {
    switch (timeframe) {
      case '15m':
        return 120;
      case '30m':
        return 100;
      case '1h':
        return 80;
      case '4h':
        return 60;
      case '1d':
        return 40;
      default:
        return 80;
    }
  }, [timeframe]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { color: '#0e1520' },
        textColor: '#a7bad5',
      },
      grid: {
        vertLines: { color: 'rgba(141,163,191,0.12)' },
        horzLines: { color: 'rgba(141,163,191,0.12)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: '#2f3d55',
      },
      timeScale: {
        borderColor: '#2f3d55',
        timeVisible: timeframe !== '1d',
        secondsVisible: false,
        barSpacing: 6,
        minBarSpacing: 2,
      },
      localization: {
        priceFormatter: (value) => `$${Number(value).toFixed(4)}`,
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      borderVisible: false,
    });

    chartRef.current = chart;
    seriesRef.current = series;
    fitDoneRef.current = false;

    const resizeObserver = new ResizeObserver(() => {
      const { clientWidth, clientHeight } = container;
      chart.applyOptions({ width: clientWidth, height: clientHeight });
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      seriesRef.current = null;
      chartRef.current = null;
      chart.remove();
    };
  }, [timeframe]);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) {
      return;
    }

    series.setData(preparedCandles);
    if (!fitDoneRef.current && preparedCandles.length > 0) {
      const rightOffset = Math.max(4, Math.floor(visibleBars * 0.06));
      const to = preparedCandles.length + rightOffset;
      const from = to - visibleBars;
      chart.timeScale().setVisibleLogicalRange({ from, to });
      fitDoneRef.current = true;
    }
  }, [preparedCandles, visibleBars]);

  const content = (
    <div className="chart-wrap">
      <div ref={containerRef} className="chart-surface" />
      {preparedCandles.length === 0 && <p className="chart-empty muted">Brak danych dla wybranego interwalu.</p>}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="card chart-card">
      <h3>
        Wykres {symbol} ({timeframe.toUpperCase()})
      </h3>
      {content}
    </div>
  );
}

export default Chart;
