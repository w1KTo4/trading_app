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
const MARKET_PREVIEW_INSTRUMENTS = [
  { symbol: 'SPX500', name: 'S&P 500 Index', type: 'INDEX', category: 'INDICES' },
  { symbol: 'NAS100', name: 'NASDAQ 100 Index', type: 'INDEX', category: 'INDICES' },
  { symbol: 'EURUSD', name: 'Euro / US Dollar', type: 'FOREX', category: 'FOREX' },
  { symbol: 'XAUUSD', name: 'Gold Spot', type: 'METAL', category: 'COMMODITIES' },
  { symbol: 'AAPL', name: 'Apple Inc.', type: 'STOCK', category: 'STOCKS' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust', type: 'ETF', category: 'ETF' },
].map((instrument) => ({
  ...instrument,
  lastPrice: null,
  leverage: null,
  active: false,
  comingSoon: true,
}));

const isTradableInstrument = (instrument) => instrument?.type === 'CRYPTO' && !instrument?.comingSoon;

const getInstrumentCategory = (instrument) => {
  if (instrument.category) {
    return instrument.category;
  }
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
  const { latestPrices, connected, paymentEvents } = useWebSocketData();
  const [activeAccountId, setActiveAccountId] = useState(accountId);
  const [portfolio, setPortfolio] = useState(EMPTY_PORTFOLIO);
  const [instruments, setInstruments] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [timeframe, setTimeframe] = useState('15m');
  const [watchTab, setWatchTab] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const activeAccountIdRef = useRef(accountId);
  const lastPaymentEventRef = useRef('');
  const [favoriteSymbols, setFavoriteSymbols] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const favoritesSet = useMemo(() => new Set(favoriteSymbols), [favoriteSymbols]);
  const visibleInstruments = useMemo(() => {
    const cryptoInstruments = instruments.filter((instrument) => instrument.type === 'CRYPTO');
    const apiSymbols = new Set(cryptoInstruments.map((instrument) => instrument.symbol));
    const previews = MARKET_PREVIEW_INSTRUMENTS.filter((instrument) => !apiSymbols.has(instrument.symbol));
    return [...cryptoInstruments, ...previews];
  }, [instruments]);
  const selectedInstrument = useMemo(
    () => visibleInstruments.find((instrument) => instrument.symbol === selectedSymbol) || null,
    [selectedSymbol, visibleInstruments],
  );
  const selectedTradable = isTradableInstrument(selectedInstrument);
  const selectedTick = selectedSymbol ? latestPrices[selectedSymbol] : null;
  const selectedLivePrice = selectedTick?.price ?? null;
  const { candles } = useInstrumentCandles({
    symbol: selectedTradable ? selectedSymbol : null,
    timeframe,
    limit: CANDLE_LIMIT,
    livePrice: selectedLivePrice,
  });
  const selectedPosition = useMemo(
    () => (portfolio?.positions || []).find((position) => position.symbol === selectedSymbol) || null,
    [portfolio, selectedSymbol],
  );
  const selectedRiskLines = useMemo(
    () =>
      [
        { type: 'TP', price: selectedPosition?.takeProfit },
        { type: 'SL', price: selectedPosition?.stopLoss },
      ].filter((line) => Number(line.price) > 0),
    [selectedPosition],
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
    return visibleInstruments
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
  }, [favoritesSet, searchTerm, visibleInstruments, watchTab]);

  const focusSymbols = useMemo(
    () => [
      selectedSymbol,
      ...favoriteSymbols.slice(0, 2),
      ...filteredInstruments.slice(0, 3).map((instrument) => instrument.symbol),
    ].filter((symbol) => visibleInstruments.some((instrument) => instrument.symbol === symbol && isTradableInstrument(instrument))),
    [favoriteSymbols, filteredInstruments, selectedSymbol, visibleInstruments],
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

      const [instrumentsRes, portfolioRes] = await Promise.allSettled([
        api.get('/api/instruments'),
        api.get(`/api/accounts/${resolvedAccountId}/portfolio`),
      ]);

      if (instrumentsRes.status === 'fulfilled') {
        const nextInstruments = instrumentsRes.value.data || [];
        setInstruments(nextInstruments);
        setSelectedSymbol((previous) => {
          const nextCryptoSymbols = nextInstruments
            .filter((instrument) => instrument.type === 'CRYPTO')
            .map((instrument) => instrument.symbol);
          if (previous && nextCryptoSymbols.includes(previous)) {
            return previous;
          }
          return nextCryptoSymbols[0] || null;
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

      setMessage(nextMessage);
    } catch {
      setPortfolio(EMPTY_PORTFOLIO);
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

  useEffect(() => {
    const latestEvent = paymentEvents?.[0];
    if (!latestEvent) {
      return;
    }

    const eventKey = [
      latestEvent.type ?? '',
      latestEvent.correlationId ?? '',
      latestEvent.status ?? '',
      latestEvent.amount ?? '',
      latestEvent.balanceAfter ?? '',
      latestEvent.createdAt ?? '',
      latestEvent.receivedAt ?? '',
    ].join('|');

    if (!eventKey || eventKey === lastPaymentEventRef.current) {
      return;
    }

    if (latestEvent.accountId && Number(latestEvent.accountId) !== Number(activeAccountIdRef.current)) {
      return;
    }

    lastPaymentEventRef.current = eventKey;
    loadTerminalData(activeAccountIdRef.current);
  }, [loadTerminalData, paymentEvents]);

  const toggleFavorite = (symbol) => {
    setFavoriteSymbols((previous) =>
      previous.includes(symbol) ? previous.filter((item) => item !== symbol) : [...previous, symbol],
    );
  };

  const mergeUpdatedPosition = useCallback((updatedPosition) => {
    if (!updatedPosition?.symbol) {
      return;
    }
    setPortfolio((previous) => ({
      ...previous,
      positions: (previous.positions || []).map((position) =>
        position.symbol === updatedPosition.symbol ? { ...position, ...updatedPosition } : position,
      ),
    }));
  }, []);

  const updatePositionRisk = useCallback(
    async (position, risk) => {
      const { data } = await api.patch(
        `/api/accounts/${activeAccountIdRef.current}/positions/${encodeURIComponent(position.symbol)}/risk`,
        {
          takeProfit: risk.takeProfit,
          stopLoss: risk.stopLoss,
        },
      );
      mergeUpdatedPosition(data);
      setMessage(`SL/TP zaktualizowane dla ${data.symbol}.`);
      await loadTerminalData(activeAccountIdRef.current);
    },
    [loadTerminalData, mergeUpdatedPosition],
  );

  const closePosition = useCallback(
    async (position) => {
      const { data } = await api.post(
        `/api/accounts/${activeAccountIdRef.current}/positions/${encodeURIComponent(position.symbol)}/close`,
      );
      setMessage(`Pozycja ${position.symbol} zamknieta po ${formatUsd(data.filledPrice ?? position.currentPrice ?? 0, 4)}.`);
      await loadTerminalData(activeAccountIdRef.current);
    },
    [loadTerminalData],
  );

  const positions = portfolio.positions || [];
  const freeMargin = Number(portfolio.equity || 0) - Number(portfolio.usedMargin || 0);
  const openPnl = positions.reduce((acc, position) => acc + Number(position.unrealizedPnl || 0), 0);
  const selectedPriceSource = formatPriceSource(selectedTick?.source || 'SNAPSHOT', connected);
  const marginLevel =
    Number(portfolio.usedMargin) > 0 ? (Number(portfolio.equity || 0) / Number(portfolio.usedMargin || 1)) * 100 : 999;
  const positionMetrics = {
    totalValue: positions.reduce(
      (acc, position) => acc + Math.abs(Number(position.quantity || 0) * Number(position.currentPrice || 0)),
      0,
    ),
    usedMargin: Number(portfolio.usedMargin || 0),
    marginLevel: Number(portfolio.usedMargin || 0) > 0 ? marginLevel : null,
    freeMargin,
    netProfit: openPnl,
  };

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
              selectedTradable ? (
                <Link className="button ghost" to={`/instrument/${selectedSymbol}`}>
                  Pelny widok {selectedSymbol}
                </Link>
              ) : (
                <span className="button ghost disabled-link">Rynek w przygotowaniu</span>
              )
          )}
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
              const tradable = isTradableInstrument(instrument);
              const price = Number(tick?.price ?? instrument.lastPrice);
              const active = selectedSymbol === instrument.symbol;
              const favorite = favoritesSet.has(instrument.symbol);

              return (
                <button
                  key={instrument.symbol}
                  type="button"
                  className={`watch-item ${active ? 'active' : ''} ${tradable ? '' : 'is-unavailable'}`}
                  onClick={() => setSelectedSymbol(instrument.symbol)}
                >
                  <span className="watch-item-main">
                    <strong>{instrument.symbol}</strong>
                    <small className="muted">{instrument.name}</small>
                  </span>
                  <span className="watch-item-side">
                    <span className="watch-item-price">{tradable ? formatUsd(price, 4) : 'Wkrotce'}</span>
                    <span className={`pill-tag ${tradable ? '' : 'pill-muted'}`}>
                      {tradable ? formatPriceSource(tick?.source || 'DB') : 'W trakcie pracy'}
                    </span>
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
                <span className={`pill-tag ${connected && selectedTradable ? 'pill-live' : ''}`}>
                  {selectedTradable ? selectedPriceSource : 'W trakcie pracy'}
                </span>
              </div>
              <p className="muted">{selectedInstrument?.name || 'Wybierz instrument z watchlisty'}</p>
            </div>
            <div className="live-price-block">
              <div className="live-price">
                {selectedTradable ? formatUsd(selectedLivePrice ?? selectedInstrument?.lastPrice ?? 0, 4) : 'Wkrotce'}
              </div>
              <small className="muted">{selectedTradable ? 'Cena referencyjna dla zlecenia' : 'Dane bez symulacji'}</small>
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

          {selectedTradable ? (
            <Chart
              embedded
              candles={candles}
              symbol={selectedSymbol || 'N/A'}
              timeframe={timeframe}
              livePrice={selectedLivePrice ?? selectedInstrument?.lastPrice ?? 0}
              priceSource={selectedPriceSource}
              riskLines={selectedRiskLines}
            />
          ) : (
            <div className="market-unavailable-panel">
              <span className="status-pill">W trakcie pracy</span>
              <h3>{selectedInstrument?.symbol || 'Rynek'}</h3>
              <p className="muted">
                Ten typ instrumentu nie ma jeszcze podlaczonego zgodnego feedu. Nie pokazujemy tu danych z symulacji.
              </p>
            </div>
          )}
        </section>

        <aside className="trade-pane">
          <OrderForm
            symbol={selectedSymbol || 'BTCUSD'}
            accountId={activeAccountId}
            lastPrice={selectedLivePrice ?? selectedInstrument?.lastPrice ?? 0}
            position={selectedPosition}
            disabledReason={selectedTradable ? '' : 'Handel jest aktualnie wlaczony tylko dla kryptowalut.'}
            onOrderPlaced={async (order) => {
              setMessage(
                order.status === 'FILLED'
                  ? `Zlecenie #${order.id} wykonane po ${formatUsd(order.filledPrice ?? selectedLivePrice ?? 0, 4)}.`
                  : `Zlecenie #${order.id} zapisane ze statusem ${order.status}.`,
              );
              await loadTerminalData(activeAccountIdRef.current);
            }}
            onRiskUpdated={async (updatedPosition) => {
              mergeUpdatedPosition(updatedPosition);
              setMessage(`SL/TP zaktualizowane dla ${updatedPosition.symbol}.`);
              await loadTerminalData(activeAccountIdRef.current);
            }}
          />
        </aside>
      </div>

      <PositionList
        positions={positions}
        title="Pozycje na koncie"
        accountMetrics={positionMetrics}
        editableRisk
        onUpdateRisk={updatePositionRisk}
        onClosePosition={closePosition}
      />

      {message && <p className="card">{message}</p>}
      {loading && <p className="card">Ladowanie danych terminala...</p>}
    </div>
  );
}

export default Dashboard;
