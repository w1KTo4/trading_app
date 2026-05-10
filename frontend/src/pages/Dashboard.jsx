import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import PositionList from '../components/PositionList';
import Chart from '../components/Chart';
import OrderForm from '../components/OrderForm';
import api from '../services/api';
import { useWebSocketData } from '../ws/useWebSocketData';
import { formatPriceSource, formatUsd } from '../utils/formatters';
import useMarketFocus from '../hooks/useMarketFocus';
import useInstrumentCandles from '../hooks/useInstrumentCandles';

const TIMEFRAMES = ['15m', '30m', '1h', '4h', '1d'];
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

function Dashboard({ accountId, onAccountChange }) {
  const { latestPrices, connected } = useWebSocketData();
  const [activeAccountId, setActiveAccountId] = useState(accountId);
  const [portfolio, setPortfolio] = useState(EMPTY_PORTFOLIO);
  const [orders, setOrders] = useState([]);
  const [instruments, setInstruments] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [timeframe, setTimeframe] = useState('15m');
  const [activeTab, setActiveTab] = useState('positions');
  const [watchTab, setWatchTab] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const activeAccountIdRef = useRef(accountId);
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
  const selectedTick = selectedSymbol ? latestPrices[selectedSymbol] : null;
  const selectedLivePrice = selectedTick?.price ?? null;
  const { candles } = useInstrumentCandles({
    symbol: selectedSymbol,
    timeframe,
    limit: CANDLE_LIMIT,
    livePrice: selectedLivePrice,
  });
  const selectedPosition = useMemo(
    () => (portfolio?.positions || []).find((position) => position.symbol === selectedSymbol) || null,
    [portfolio, selectedSymbol],
  );

  useEffect(() => {
    setActiveAccountId(accountId);
  }, [accountId]);

  useEffect(() => {
    activeAccountIdRef.current = activeAccountId;
  }, [activeAccountId]);

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

  const focusSymbols = useMemo(
    () => [
      selectedSymbol,
      ...favoriteSymbols.slice(0, 2),
      ...filteredInstruments.slice(0, 3).map((instrument) => instrument.symbol),
    ],
    [favoriteSymbols, filteredInstruments, selectedSymbol],
  );
  useMarketFocus(focusSymbols);

  const loadTerminalData = useCallback(async (preferredAccountId) => {
    const requestedAccountId = Number(preferredAccountId || activeAccountIdRef.current || accountId || 0);
    if (!requestedAccountId) {
      return;
    }

    setLoading(true);
    let nextMessage = '';
    let resolvedAccountId = requestedAccountId;

    try {
      const profileRes = await api.get('/api/auth/me');
      const profileAccountIds = profileRes.data?.accountIds || [];
      if (profileAccountIds.length > 0 && !profileAccountIds.includes(requestedAccountId)) {
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
  }, [accountId, onAccountChange]);

  useEffect(() => {
    if (!accountId) {
      return;
    }
    loadTerminalData(accountId);
  }, [accountId, loadTerminalData]);

  const toggleFavorite = (symbol) => {
    setFavoriteSymbols((previous) =>
      previous.includes(symbol) ? previous.filter((item) => item !== symbol) : [...previous, symbol],
    );
  };

  const positions = portfolio.positions || [];
  const freeMargin = Number(portfolio.equity || 0) - Number(portfolio.usedMargin || 0);
  const openPnl = positions.reduce((acc, position) => acc + Number(position.unrealizedPnl || 0), 0);
  const pendingOrders = orders.filter((order) => order.status === 'NEW').length;
  const selectedOrders = orders.filter((order) => order.symbol === selectedSymbol).slice(0, 3);
  const selectedPriceSource = formatPriceSource(selectedTick?.source || 'SNAPSHOT', connected);
  const marginLevel =
    Number(portfolio.usedMargin) > 0 ? (Number(portfolio.equity || 0) / Number(portfolio.usedMargin || 1)) * 100 : 999;

  if (!activeAccountId) {
    return <p>Brak accountId. Zaloguj sie ponownie.</p>;
  }

  return (
    <div className="stack terminal-stack">
      <div className="card quick-actions-bar hero-card">
        <div>
          <p className="eyebrow">Trading workspace</p>
          <h2>Terminal</h2>
          <p className="muted">Jedno miejsce do obserwacji rynku, otwierania pozycji i kontroli ryzyka.</p>
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

      <div className="summary-grid summary-grid-rich">
        <div className="card summary-card">
          <p className="muted">Balance</p>
          <h2>{formatUsd(portfolio.balance, 2)}</h2>
          <span className="summary-note">Kapital bazowy bez otwartego P&L.</span>
        </div>
        <div className="card summary-card">
          <p className="muted">Equity</p>
          <h2>{formatUsd(portfolio.equity, 2)}</h2>
          <span className={`summary-note ${openPnl >= 0 ? 'pnl-positive' : 'pnl-negative'}`}>Open P&L {formatUsd(openPnl, 2)}</span>
        </div>
        <div className="card summary-card">
          <p className="muted">Free margin</p>
          <h2>{formatUsd(freeMargin, 2)}</h2>
          <span className="summary-note">Margin level {Number.isFinite(marginLevel) ? `${marginLevel.toFixed(0)}%` : 'n/a'}</span>
        </div>
        <div className="card summary-card">
          <p className="muted">Aktywne pozycje</p>
          <h2>{positions.length}</h2>
          <span className="summary-note">{pendingOrders} oczekujacych zlecen</span>
        </div>
        <div className="card summary-card">
          <p className="muted">Wybrany instrument</p>
          <h2>{selectedSymbol || 'Brak'}</h2>
          <span className="summary-note">{selectedInstrument?.type || 'Wybierz z watchlisty'}</span>
        </div>
        <div className="card summary-card">
          <p className="muted">Connection</p>
          <h2 className={connected ? 'pnl-positive' : 'pnl-negative'}>{connected ? 'LIVE' : 'OFFLINE'}</h2>
          <span className="summary-note">{selectedPriceSource}</span>
        </div>
      </div>

      <div className="terminal-grid">
        <aside className="card watchlist-pane">
          <div className="panel-head">
            <div>
              <h3>Watchlist</h3>
              <p className="muted">Ulubione symbole i szybkie przejscie do decyzji.</p>
            </div>
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
              const tick = latestPrices[instrument.symbol];
              const price = Number(tick?.price ?? instrument.lastPrice);
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
                    <span className="watch-item-price">{formatUsd(price, 4)}</span>
                    <span className="pill-tag">{formatPriceSource(tick?.source || 'DB')}</span>
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

        <section className="card chart-pane chart-pane-rich">
          <div className="panel-head chart-panel-head">
            <div>
              <div className="headline-row">
                <h3>{selectedInstrument?.symbol || 'N/A'}</h3>
                {selectedInstrument?.type && <span className="pill-tag">{selectedInstrument.type}</span>}
                <span className={`pill-tag ${connected ? 'pill-live' : ''}`}>{selectedPriceSource}</span>
              </div>
              <p className="muted">{selectedInstrument?.name || 'Wybierz instrument z watchlisty'}</p>
            </div>
            <div className="live-price-block">
              <div className="live-price">{formatUsd(selectedLivePrice ?? selectedInstrument?.lastPrice ?? 0, 4)}</div>
              <small className="muted">Cena referencyjna dla zlecenia</small>
            </div>
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

          <Chart
            embedded
            candles={candles}
            symbol={selectedSymbol || 'N/A'}
            timeframe={timeframe}
            livePrice={selectedLivePrice ?? selectedInstrument?.lastPrice ?? 0}
            priceSource={selectedPriceSource}
          />

          <div className="selected-symbol-card">
            <div className="info-chip">
              <p className="muted">Pozycja</p>
              <strong>{selectedPosition ? (Number(selectedPosition.quantity) >= 0 ? 'LONG' : 'SHORT') : 'Brak'}</strong>
            </div>
            <div className="info-chip">
              <p className="muted">Ilosc</p>
              <strong>{selectedPosition ? Math.abs(Number(selectedPosition.quantity)).toFixed(2) : '0.00'}</strong>
            </div>
            <div className="info-chip">
              <p className="muted">Open P&L</p>
              <strong className={Number(selectedPosition?.unrealizedPnl || 0) >= 0 ? 'pnl-positive' : 'pnl-negative'}>
                {formatUsd(selectedPosition?.unrealizedPnl || 0, 2)}
              </strong>
            </div>
            <div className="info-chip">
              <p className="muted">Ostatnie zlecenia</p>
              <strong>{selectedOrders.length}</strong>
            </div>
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
              await loadTerminalData(activeAccountIdRef.current);
            }}
          />

          <div className="card order-context-card">
            <div className="panel-head">
              <h3>Kontekst decyzji</h3>
              <span className="muted">{selectedSymbol || 'N/A'}</span>
            </div>
            <div className="mini-stat-grid">
              <div className="mini-stat">
                <p className="muted">Srednia pozycji</p>
                <strong>{formatUsd(selectedPosition?.averagePrice || 0, 4)}</strong>
              </div>
              <div className="mini-stat">
                <p className="muted">Aktualna cena</p>
                <strong>{formatUsd(selectedLivePrice ?? selectedInstrument?.lastPrice ?? 0, 4)}</strong>
              </div>
              <div className="mini-stat">
                <p className="muted">Used margin</p>
                <strong>{formatUsd(portfolio.usedMargin, 2)}</strong>
              </div>
              <div className="mini-stat">
                <p className="muted">Free margin</p>
                <strong>{formatUsd(freeMargin, 2)}</strong>
              </div>
            </div>
          </div>
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
        <PositionList positions={positions} title="Pozycje na koncie" />
      ) : (
        <div className="card">
          <div className="panel-head">
            <div>
              <h3>Ostatnie zlecenia</h3>
              <p className="muted">Historia wykonanych i oczekujacych decyzji.</p>
            </div>
            <span className="muted">{orders.length}</span>
          </div>
          <div className="table-wrap">
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
                    <td>
                      <span className={`trade-side ${order.side === 'BUY' ? 'buy' : 'sell'}`}>{order.side}</span>
                    </td>
                    <td>{order.type}</td>
                    <td>{order.status}</td>
                    <td>{Number(order.quantity).toFixed(2)}</td>
                    <td>{formatUsd(order.filledPrice ?? order.limitPrice ?? 0, 4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {message && <p className="card">{message}</p>}
      {loading && <p className="card">Ladowanie danych terminala...</p>}
    </div>
  );
}

export default Dashboard;
