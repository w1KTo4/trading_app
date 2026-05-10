import { useEffect, useState } from 'react';
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
  const [message, setMessage] = useState('');

  const currentTick = latestPrices[symbol];
  const currentLivePrice = currentTick?.price;
  const currentSource = formatPriceSource(currentTick?.source || 'SNAPSHOT', connected);
  const { candles } = useInstrumentCandles({
    symbol,
    timeframe: INSTRUMENT_TIMEFRAME,
    limit: INSTRUMENT_CANDLE_LIMIT,
    livePrice: currentLivePrice,
  });
  useMarketFocus([symbol]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const instrumentRes = await api.get(`/api/instruments/${symbol}`);
      if (active) {
        setInstrument(instrumentRes.data);
      }
    };

    load().catch(() => {
      if (active) {
        setInstrument(null);
      }
    });

    return () => {
      active = false;
    };
  }, [symbol]);

  useEffect(() => {
    if (orderEvents[0]) {
      setMessage(`Ostatnie potwierdzenie: ${orderEvents[0].symbol} ${orderEvents[0].status}`);
    }
  }, [orderEvents]);

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
          <Chart
            candles={candles}
            symbol={symbol}
            timeframe={INSTRUMENT_TIMEFRAME}
            livePrice={currentLivePrice ?? instrument?.lastPrice ?? 0}
            priceSource={currentSource}
          />
        </div>

        <div className="instrument-side">
          <OrderForm
            symbol={symbol}
            accountId={accountId}
            lastPrice={currentLivePrice ?? instrument?.lastPrice ?? 0}
            onOrderPlaced={(order) =>
              setMessage(
                order.status === 'FILLED'
                  ? `Zlecenie #${order.id} wykonane po ${formatUsd(order.filledPrice ?? currentLivePrice ?? instrument?.lastPrice ?? 0, 4)}.`
                  : `Zlecenie #${order.id} ${order.status}.`,
              )
            }
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
