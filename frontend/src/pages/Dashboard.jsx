import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import PositionList from '../components/PositionList';
import Chart from '../components/Chart';
import OrderForm from '../components/OrderForm';
import { useWebSocketData } from '../ws/WebSocketProvider';
import { formatUsd } from '../utils/formatters';

const TIMEFRAMES = ['15m', '30m', '1h', '4h', '1d'];
const TIMEFRAME_MS = {
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
};
const WATCH_TABS = [
  { key: 'ALL', label: 'Wszystkie' },
  { key: 'FAVORITES', label: 'Ulubione' },
  { key: 'INDICES', label: 'Indeksy' },
  { key: 'CRYPTO', label: 'Krypto' },
  { key: 'STOCKS', label: 'Akcje' },
  { key: 'COMMODITIES', label: 'Surowce' },
  { key: 'FOREX', label: 'Forex' },
  { key: 'ETF', label: 'ETF' },
];
const FAVORITES_STORAGE_KEY = 'favoriteSymbols';
const CANDLE_LIMIT = 260;
const EMPTY_PORTFOLIO = { balance: 0, equity: 0, usedMargin: 0, positions: [] };

const getInstrumentCategory = (instrument) => {
  switch (instrument.type) {
    case 'INDEX':
      return 'INDICES';
    case 'CRYPTO':
      return 'CRYPTO';
    case 'STOCK':
      return 'STOCKS';
    case 'COMMODITY':
    case 'METAL':
      return 'COMMODITIES';
    case 'FOREX':
      return 'FOREX';
    case 'ETF':
      return 'ETF';
    default:
      return 'ALL';
  }
};

const normalizeCandle = (candle) => ({
  time: candle.time,
  open: Number(candle.open),
  high: Number(candle.high),
  low: Number(candle.low),
  close: Number(candle.close),
});

const updateCandlesWithTick = (previousCandles, nextPrice, timeframe) => {
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
  if (next.length > CANDLE_LIMIT) {
    return next.slice(next.length - CANDLE_LIMIT);
  }
  return next;
};

function Dashboard({ accountId, onAccountChange }) {
  const { latestPrices, connected } = useWebSocketData();
  const [activeAccountId, setActiveAccountId] = useState(accountId);
  const [portfolio, setPortfolio] = useState(EMPTY_PORTFOLIO);
  const [orders, setOrders] = useState([]);
  const [instruments, setInstruments] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [candles, setCandles] = useState([]);
  const [timeframe, setTimeframe] = useState('15m');
  const [activeTab, setActiveTab] = useState('positions');
  const [watchTab, setWatchTab] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [favoriteSymbols, setFavoriteSymbols] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const favoritesSet = useMemo(() => new Set(favoriteSymbols), [favoriteSymbols]);
  const selectedInstrument = useMemo(
    () => instruments.find((instrument) => instrument.symbol === selectedSymbol) || null,
    [instruments, selectedSymbol],
  );
  const selectedLivePrice = selectedSymbol ? latestPrices[selectedSymbol]?.price : null;
  const selectedPosition = useMemo(
    () => (portfolio?.positions || []).find((position) => position.symbol === selectedSymbol) || null,
    [portfolio, selectedSymbol],
  );

  useEffect(() => {
    setActiveAccountId(accountId);
  }, [accountId]);

  useEffect(() => {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoriteSymbols));
  }, [favoriteSymbols]);

  const filteredInstruments = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return instruments
      .filter((instrument) => {
        if (watchTab === 'FAVORITES' && !favoritesSet.has(instrument.symbol)) {
          return false;
        }
        if (watchTab !== 'ALL' && watchTab !== 'FAVORITES' && getInstrumentCategory(instrument) !== watchTab) {
          return false;
        }
        if (!search) {
          return true;
        }
        return instrument.symbol.toLowerCase().includes(search) || instrument.name.toLowerCase().includes(search);
      })
      .sort((left, right) => {
        const favDiff = Number(favoritesSet.has(right.symbol)) - Number(favoritesSet.has(left.symbol));
        if (favDiff !== 0) {
          return favDiff;
        }
        return left.symbol.localeCompare(right.symbol);
      });
  }, [favoritesSet, instruments, searchTerm, watchTab]);

  const loadTerminalData = async (preferredAccountId = activeAccountId || accountId) => {
    if (!preferredAccountId) {
      return;
    }

    setLoading(true);
    let nextMessage = '';
    let resolvedAccountId = preferredAccountId;

    try {
      const profileRes = await api.get('/api/auth/me');
      const profileAccountIds = profileRes.data?.accountIds || [];
      if (profileAccountIds.length > 0 && !profileAccountIds.includes(preferredAccountId)) {
        resolvedAccountId = profileAccountIds[0];
        onAccountChange?.(resolvedAccountId);
        nextMessage = `Przelaczono aktywne konto na #${resolvedAccountId}.`;
      }

      setActiveAccountId(resolvedAccountId);

      const [instrumentsRes, portfolioRes, ordersRes] = await Promise.allSettled([
        api.get('/api/instruments'),
        api.get(`/api/accounts/${resolvedAccountId}/portfolio`),
        api.get(`/api/accounts/${resolvedAccountId}/orders`),
      ]);

      if (instrumentsRes.status === 'fulfilled') {
        const nextInstruments = instrumentsRes.value.data || [];
        setInstruments(nextInstruments);
        setSelectedSymbol((previous) => {
          if (previous && nextInstruments.some((instrument) => instrument.symbol === previous)) {
            return previous;
          }
          return nextInstruments[0]?.symbol || null;
        });
      } else {
        setInstruments([]);
        nextMessage = nextMessage || 'Nie udalo sie pobrac instrumentow.';
      }

      if (portfolioRes.status === 'fulfilled') {
        setPortfolio(portfolioRes.value.data || EMPTY_PORTFOLIO);
      } else {
        setPortfolio(EMPTY_PORTFOLIO);
        nextMessage = nextMessage || 'Brak dostepu do portfela.';
      }

      if (ordersRes.status === 'fulfilled') {
        setOrders(ordersRes.value.data || []);
      } else {
        setOrders([]);
        nextMessage = nextMessage || 'Brak dostepu do historii zlecen.';
      }

      setMessage(nextMessage);
    } catch {
      setPortfolio(EMPTY_PORTFOLIO);
      setOrders([]);
      setInstruments([]);
      setMessage('Nie udalo sie pobrac danych terminala.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!accountId) {
      return;
    }
    loadTerminalData(accountId);
  }, [accountId]);

  useEffect(() => {
    if (!selectedSymbol) {
      setCandles([]);
      return;
    }

    api
      .get(`/api/instruments/${selectedSymbol}/candles?timeframe=${timeframe}&limit=${CANDLE_LIMIT}`)
      .then((res) => setCandles(res.data.map(normalizeCandle)))
      .catch(() => setCandles([]));
  }, [selectedSymbol, timeframe]);

  useEffect(() => {
    if (!selectedSymbol || selectedLivePrice == null) {
      return;
    }
    setCandles((prev) => updateCandlesWithTick(prev, selectedLivePrice, timeframe));
  }, [selectedLivePrice, selectedSymbol, timeframe]);

  const toggleFavorite = (symbol) => {
    setFavoriteSymbols((previous) =>
      previous.includes(symbol) ? previous.filter((item) => item !== symbol) : [...previous, symbol],
    );
  };

  if (!activeAccountId) {
    return <p>Brak accountId. Zaloguj sie ponownie.</p>;
  }

  return (
    <div className="stack">
      <div className="card quick-actions-bar">
        <div>
          <h2>Terminal</h2>
          <p className="muted">Konto #{activeAccountId} - handel z szybkim odswiezaniem po zleceniu.</p>
        </div>
        <div className="quick-links">
          <Link className="button ghost" to="/market">
            Przegladaj rynek
          </Link>
          <Link className="button ghost" to="/portfolio">
            Otworz portfolio
          </Link>
          {selectedSymbol && (
            <Link className="button ghost" to={`/instrument/${selectedSymbol}`}>
              Pelny widok {selectedSymbol}
            </Link>
          )}
        </div>
      </div>

      <div className="card summary-grid">
        <div>
          <p className="muted">Balance (USD)</p>
          <h2>{formatUsd(portfolio.balance, 2)}</h2>
        </div>
        <div>
          <p className="muted">Equity (USD)</p>
          <h2>{formatUsd(portfolio.equity, 2)}</h2>
        </div>
        <div>
          <p className="muted">Used Margin (USD)</p>
          <h2>{formatUsd(portfolio.usedMargin, 2)}</h2>
        </div>
        <div>
          <p className="muted">Otwarte pozycje</p>
          <h2>{portfolio.positions?.length || 0}</h2>
        </div>
        <div>
          <p className="muted">Wybrany instrument</p>
          <h2>{selectedSymbol || 'Brak'}</h2>
        </div>
        <div>
          <p className="muted">Connection</p>
          <h2 className={connected ? 'pnl-positive' : 'pnl-negative'}>{connected ? 'LIVE' : 'OFFLINE'}</h2>
        </div>
      </div>

      <div className="terminal-grid">
        <aside className="card watchlist-pane">
          <div className="panel-head">
            <h3>Watchlist</h3>
            <span className="muted">{filteredInstruments.length}</span>
          </div>

          <input
            className="watch-search"
            type="text"
            placeholder="Szukaj symbolu albo nazwy..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />

          <div className="watch-tabs">
            {WATCH_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`button ghost watch-tab ${watchTab === tab.key ? 'active-tab' : ''}`}
                onClick={() => setWatchTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="watchlist">
            {filteredInstruments.map((instrument) => {
              const price = Number(latestPrices[instrument.symbol]?.price ?? instrument.lastPrice);
              const active = selectedSymbol === instrument.symbol;
              const favorite = favoritesSet.has(instrument.symbol);

              return (
                <button
                  key={instrument.symbol}
                  type="button"
                  className={`watch-item ${active ? 'active' : ''}`}
                  onClick={() => setSelectedSymbol(instrument.symbol)}
                >
                  <span className="watch-item-main">
                    <strong>{instrument.symbol}</strong>
                    <small className="muted">{instrument.name}</small>
                  </span>
                  <span className="watch-item-side">
                    <span>{formatUsd(price, 4)}</span>
                    <span
                      className={`favorite-btn ${favorite ? 'is-favorite' : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleFavorite(instrument.symbol);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          event.stopPropagation();
                          toggleFavorite(instrument.symbol);
                        }
                      }}
                    >
                      {favorite ? '*' : '+'}
                    </span>
                  </span>
                </button>
              );
            })}
            {filteredInstruments.length === 0 && <p className="muted">Brak instrumentow dla tego filtra.</p>}
          </div>
        </aside>

        <section className="card chart-pane">
          <div className="panel-head">
            <div>
              <h3>{selectedInstrument?.symbol || 'N/A'}</h3>
              <p className="muted">{selectedInstrument?.name || 'Wybierz instrument'}</p>
            </div>
            <div className="live-price">{formatUsd(selectedLivePrice ?? selectedInstrument?.lastPrice ?? 0, 4)}</div>
          </div>

          <div className="timeframe-row">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                type="button"
                className={`button ghost timeframe-btn ${timeframe === tf ? 'active-tab' : ''}`}
                onClick={() => setTimeframe(tf)}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>

          <Chart embedded candles={candles} symbol={selectedSymbol || 'N/A'} timeframe={timeframe} />

          <div className="selected-symbol-card">
            {selectedPosition ? (
              <>
                <div>
                  <p className="muted">Aktywna pozycja</p>
                  <strong>{Number(selectedPosition.quantity) >= 0 ? 'LONG' : 'SHORT'}</strong>
                </div>
                <div>
                  <p className="muted">Ilosc</p>
                  <strong>{Number(selectedPosition.quantity).toFixed(2)}</strong>
                </div>
                <div>
                  <p className="muted">Open P&L</p>
                  <strong className={Number(selectedPosition.unrealizedPnl) >= 0 ? 'pnl-positive' : 'pnl-negative'}>
                    {formatUsd(selectedPosition.unrealizedPnl, 2)}
                  </strong>
                </div>
              </>
            ) : (
              <p className="muted">Brak otwartej pozycji dla wybranego instrumentu.</p>
            )}
          </div>
        </section>

        <aside className="trade-pane">
          <OrderForm
            symbol={selectedSymbol || 'AAPL'}
            accountId={activeAccountId}
            lastPrice={selectedLivePrice ?? selectedInstrument?.lastPrice ?? 0}
            position={selectedPosition}
            onOrderPlaced={async (order) => {
              setMessage(
                order.status === 'FILLED'
                  ? `Zlecenie #${order.id} wykonane po ${formatUsd(order.filledPrice ?? selectedLivePrice ?? 0, 4)}.`
                  : `Zlecenie #${order.id} zapisane ze statusem ${order.status}.`,
              );
              setActiveTab(order.status === 'FILLED' ? 'positions' : 'orders');
              await loadTerminalData(activeAccountId);
            }}
          />
        </aside>
      </div>

      <div className="card tabs-row">
        <button
          type="button"
          className={`button ghost ${activeTab === 'positions' ? 'active-tab' : ''}`}
          onClick={() => setActiveTab('positions')}
        >
          Pozycje
        </button>
        <button
          type="button"
          className={`button ghost ${activeTab === 'orders' ? 'active-tab' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          Ostatnie zlecenia
        </button>
      </div>

      {activeTab === 'positions' ? (
        <PositionList positions={portfolio.positions || []} title="Pozycje na koncie" />
      ) : (
        <div className="card">
          <div className="panel-head">
            <h3>Ostatnie zlecenia</h3>
            <span className="muted">{orders.length}</span>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Symbol</th>
                <th>Side</th>
                <th>Type</th>
                <th>Status</th>
                <th>Qty</th>
                <th>Price (USD)</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr>
                  <td colSpan={7}>Brak zlecen</td>
                </tr>
              )}
              {orders.slice(0, 15).map((order) => (
                <tr key={order.id}>
                  <td>{order.id}</td>
                  <td>{order.symbol}</td>
                  <td>{order.side}</td>
                  <td>{order.type}</td>
                  <td>{order.status}</td>
                  <td>{Number(order.quantity).toFixed(2)}</td>
                  <td>{formatUsd(order.filledPrice ?? order.limitPrice ?? 0, 4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {message && <p className="card">{message}</p>}
      {loading && <p className="card">Ladowanie danych terminala...</p>}
    </div>
  );
}

export default Dashboard;
