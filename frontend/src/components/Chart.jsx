import { useEffect, useMemo, useRef } from 'react';
import { createChart, CrosshairMode, CandlestickSeries, LineStyle } from 'lightweight-charts';

const EMPTY_RISK_LINES = [];

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

function Chart({
  candles = [],
  points = [],
  symbol = 'N/A',
  timeframe = '15m',
  embedded = false,
  livePrice = 0,
  priceSource = 'SNAPSHOT',
  riskLines = EMPTY_RISK_LINES,
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const priceLinesRef = useRef([]);
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

  const normalizedRiskLines = useMemo(
    () =>
      riskLines
        .map((line) => {
          const price = Number(line?.price);
          if (!Number.isFinite(price) || price <= 0) {
            return null;
          }
          return {
            type: line?.type === 'TP' ? 'TP' : 'SL',
            price,
          };
        })
        .filter(Boolean),
    [riskLines],
  );

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
      watermark: {
        visible: true,
        text: `${symbol} ${timeframe.toUpperCase()}`,
        color: 'rgba(167, 186, 213, 0.08)',
        fontSize: 26,
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
      priceLinesRef.current = [];
      seriesRef.current = null;
      chartRef.current = null;
      chart.remove();
    };
  }, [symbol, timeframe]);

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

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) {
      return;
    }

    const riskPrices = normalizedRiskLines.map((line) => line.price);
    series.applyOptions({
      autoscaleInfoProvider: (original) => {
        const base = original();
        if (riskPrices.length === 0) {
          return base;
        }

        const minRisk = Math.min(...riskPrices);
        const maxRisk = Math.max(...riskPrices);
        const baseRange = base?.priceRange;
        let minValue = baseRange ? Math.min(baseRange.minValue, minRisk) : minRisk;
        let maxValue = baseRange ? Math.max(baseRange.maxValue, maxRisk) : maxRisk;

        if (minValue === maxValue) {
          const padding = Math.max(Math.abs(minValue) * 0.002, 0.0001);
          minValue -= padding;
          maxValue += padding;
        }

        return {
          priceRange: { minValue, maxValue },
          margins: {
            above: Math.max(base?.margins?.above ?? 0, 18),
            below: Math.max(base?.margins?.below ?? 0, 18),
          },
        };
      },
    });

    priceLinesRef.current.forEach((line) => series.removePriceLine(line));
    priceLinesRef.current = normalizedRiskLines
      .map((line) => {
        const { price } = line;
        const isTakeProfit = line.type === 'TP';
        return series.createPriceLine({
          price,
          color: isTakeProfit ? '#22c55e' : '#ef4444',
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `${line.type} ${price.toFixed(4)}`,
        });
      })
      .filter(Boolean);
  }, [normalizedRiskLines, symbol, timeframe]);

  const content = (
    <div className="chart-wrap">
      <div ref={containerRef} className="chart-surface" />
      {normalizedRiskLines.length > 0 && (
        <div className="chart-risk-legend">
          {normalizedRiskLines.map((line) => {
            const { price } = line;
            return (
              <span key={`${line.type}-${price}`} className={`risk-line-chip ${line.type === 'TP' ? 'tp' : 'sl'}`}>
                {line.type} ${price.toFixed(4)}
              </span>
            );
          })}
        </div>
      )}
      {preparedCandles.length === 0 && <p className="chart-empty muted">Brak danych dla wybranego interwalu.</p>}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="card chart-card">
      <div className="panel-head">
        <div>
          <h3>
            Wykres {symbol} ({timeframe.toUpperCase()})
          </h3>
          <p className="muted">Feed: {priceSource}</p>
        </div>
        <div className="live-price-block">
          <div className="live-price">{Number.isFinite(Number(livePrice)) ? `$${Number(livePrice).toFixed(4)}` : '$0.0000'}</div>
          <small className="muted">Cena live</small>
        </div>
      </div>
      {content}
    </div>
  );
}

export default Chart;
