import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../services/api';
import Chart from '../components/Chart';
import OrderForm from '../components/OrderForm';
import { useWebSocketData } from '../ws/useWebSocketData';
import { formatPriceSource, formatUsd } from '../utils/formatters';
import useMarketFocus from '../hooks/useMarketFocus';
import useInstrumentCandles from '../hooks/useInstrumentCandles';

const INSTRUMENT_TIMEFRAME = '15m';
const INSTRUMENT_CANDLE_LIMIT = 200;

function Instrument({ accountId }) {
  const { symbol } = useParams();
  const { latestPrices, orderEvents, connected } = useWebSocketData();
  const [instrument, setInstrument] = useState(null);
  const [position, setPosition] = useState(null);
  const [message, setMessage] = useState('');

  const currentTick = latestPrices[symbol];
  const currentLivePrice = currentTick?.price;
  const instrumentTradable = instrument?.type === 'CRYPTO';
  const currentSource = formatPriceSource(currentTick?.source || 'SNAPSHOT', connected);
  const positionMatchesSymbol = String(position?.symbol || '').toUpperCase() === String(symbol || '').toUpperCase();
  const { candles } = useInstrumentCandles({
    symbol: instrumentTradable ? symbol : null,
    timeframe: INSTRUMENT_TIMEFRAME,
    limit: INSTRUMENT_CANDLE_LIMIT,
    livePrice: currentLivePrice,
  });
  const riskLines = useMemo(
    () =>
      [
        { type: 'TP', price: positionMatchesSymbol ? position?.takeProfit : null },
        { type: 'SL', price: positionMatchesSymbol ? position?.stopLoss : null },
      ].filter((line) => Number(line.price) > 0),
    [position, positionMatchesSymbol],
  );
  useMarketFocus([symbol]);

  const loadInstrumentView = useCallback(async () => {
    const [instrumentRes, portfolioRes] = await Promise.allSettled([
      api.get(`/api/instruments/${symbol}`),
      accountId ? api.get(`/api/accounts/${accountId}/portfolio`) : Promise.resolve({ data: { positions: [] } }),
    ]);

    if (instrumentRes.status === 'fulfilled') {
      setInstrument(instrumentRes.value.data);
    } else {
      setInstrument(null);
    }

    if (portfolioRes.status === 'fulfilled') {
      const positions = portfolioRes.value.data?.positions || [];
      setPosition(positions.find((entry) => entry.symbol === symbol) || null);
    } else {
      setPosition(null);
    }
  }, [accountId, symbol]);

  useEffect(() => {
    loadInstrumentView();
  }, [loadInstrumentView]);

  useEffect(() => {
    if (orderEvents[0]) {
      setMessage(`Ostatnie potwierdzenie: ${orderEvents[0].symbol} ${orderEvents[0].status}`);
      loadInstrumentView();
    }
  }, [loadInstrumentView, orderEvents]);

  return (
    <div className="stack">
      <div className="card quick-actions-bar hero-card">
        <div>
          <p className="eyebrow">Instrument focus</p>
          <h2>{instrument?.symbol || symbol}</h2>
          <p className="muted">{instrument?.name || 'Pelny widok instrumentu'}</p>
        </div>
        <div className="quick-links">
          <span className={`status-pill ${connected ? 'is-live' : ''}`}>{currentSource}</span>
          <span className="status-pill">{formatUsd(currentLivePrice ?? instrument?.lastPrice ?? 0, 4)}</span>
          <Link className="button ghost" to="/dashboard">
            Wroc do terminala
          </Link>
          <Link className="button ghost" to="/portfolio">
            Otworz portfolio
          </Link>
        </div>
      </div>

      <div className="instrument-layout">
        <div className="instrument-main">
          {instrumentTradable ? (
            <Chart
              candles={candles}
              symbol={symbol}
              timeframe={INSTRUMENT_TIMEFRAME}
              livePrice={currentLivePrice ?? instrument?.lastPrice ?? 0}
              priceSource={currentSource}
              riskLines={riskLines}
            />
          ) : (
            <div className="card market-unavailable-panel">
              <span className="status-pill">W trakcie pracy</span>
              <h3>{symbol}</h3>
              <p className="muted">
                Ten rynek nie ma jeszcze podlaczonego zgodnego feedu. Handel i wykresy sa aktywne tylko dla kryptowalut.
              </p>
            </div>
          )}
        </div>

        <div className="instrument-side">
          <OrderForm
            symbol={symbol}
            accountId={accountId}
            lastPrice={currentLivePrice ?? instrument?.lastPrice ?? 0}
            position={positionMatchesSymbol ? position : null}
            disabledReason={instrumentTradable ? '' : 'Handel jest aktualnie wlaczony tylko dla kryptowalut.'}
            onOrderPlaced={async (order) => {
              setMessage(
                order.status === 'FILLED'
                  ? `Zlecenie #${order.id} wykonane po ${formatUsd(order.filledPrice ?? currentLivePrice ?? instrument?.lastPrice ?? 0, 4)}.`
                  : `Zlecenie #${order.id} ${order.status}.`,
              );
              await loadInstrumentView();
            }}
            onRiskUpdated={async (updatedPosition) => {
              setPosition(updatedPosition);
              setMessage(`SL/TP zaktualizowane dla ${updatedPosition.symbol}.`);
              await loadInstrumentView();
            }}
          />

          <div className="card order-context-card">
            <div className="panel-head">
              <h3>Snapshot</h3>
              <span className="muted">{instrument?.type || 'N/A'}</span>
            </div>
            <div className="mini-stat-grid">
              <div className="mini-stat">
                <p className="muted">Cena live</p>
                <strong>{formatUsd(currentLivePrice ?? instrument?.lastPrice ?? 0, 4)}</strong>
              </div>
              <div className="mini-stat">
                <p className="muted">Leverage</p>
                <strong>{instrument?.leverage || 1}x</strong>
              </div>
              <div className="mini-stat">
                <p className="muted">Source</p>
                <strong>{currentSource}</strong>
              </div>
              <div className="mini-stat">
                <p className="muted">Interwal</p>
                <strong>{INSTRUMENT_TIMEFRAME.toUpperCase()}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {message && <p className="card">{message}</p>}
    </div>
  );
}

export default Instrument;
