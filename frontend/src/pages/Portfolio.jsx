import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PositionList from '../components/PositionList';
import api from '../services/api';
import { formatUsd } from '../utils/formatters';

const EMPTY_PORTFOLIO = {
  balance: 0,
  equity: 0,
  usedMargin: 0,
  positions: [],
};

const sumBy = (items, selector) =>
  items.reduce((acc, item) => {
    const value = Number(selector(item));
    return Number.isFinite(value) ? acc + value : acc;
  }, 0);

const formatDateTime = (value) => {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return date.toLocaleString('pl-PL', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

function Portfolio({ accountId, onAccountChange }) {
  const [activeAccountId, setActiveAccountId] = useState(accountId);
  const [portfolio, setPortfolio] = useState(EMPTY_PORTFOLIO);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setActiveAccountId(accountId);
  }, [accountId]);

  const loadPortfolio = async (preferredAccountId = activeAccountId || accountId) => {
    if (!preferredAccountId) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      let resolvedAccountId = preferredAccountId;
      const profileRes = await api.get('/api/auth/me');
      const profileAccountIds = profileRes.data?.accountIds || [];
      if (profileAccountIds.length > 0 && !profileAccountIds.includes(preferredAccountId)) {
        resolvedAccountId = profileAccountIds[0];
        onAccountChange?.(resolvedAccountId);
      }

      setActiveAccountId(resolvedAccountId);

      const [portfolioRes, tradesRes] = await Promise.allSettled([
        api.get(`/api/accounts/${resolvedAccountId}/portfolio`),
        api.get(`/api/accounts/${resolvedAccountId}/trades`),
      ]);

      if (portfolioRes.status === 'fulfilled') {
        setPortfolio(portfolioRes.value.data || EMPTY_PORTFOLIO);
      } else {
        setPortfolio(EMPTY_PORTFOLIO);
        setError('Nie udalo sie pobrac danych portfela.');
      }

      if (tradesRes.status === 'fulfilled') {
        setTrades(Array.isArray(tradesRes.value.data) ? tradesRes.value.data : []);
      } else {
        setTrades([]);
        setError((previous) => previous || 'Nie udalo sie pobrac historii transakcji.');
      }
    } catch {
      setPortfolio(EMPTY_PORTFOLIO);
      setTrades([]);
      setError('Nie udalo sie pobrac danych portfela.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!accountId) {
      return;
    }
    loadPortfolio(accountId);
  }, [accountId]);

  const stats = useMemo(() => {
    const positions = portfolio?.positions || [];
    const unrealizedPnl = sumBy(positions, (item) => item.unrealizedPnl);
    const equity = Number(portfolio?.equity || 0);
    const usedMargin = Number(portfolio?.usedMargin || 0);
    const freeMargin = equity - usedMargin;

    return {
      unrealizedPnl,
      freeMargin,
      positionsCount: positions.length,
      recentTrades: trades.slice(0, 8),
    };
  }, [portfolio, trades]);

  if (!activeAccountId) {
    return <p>Brak accountId. Zaloguj sie ponownie.</p>;
  }

  return (
    <div className="stack">
      <div className="card quick-actions-bar">
        <div>
          <h2>Portfolio</h2>
          <p className="muted">Najwazniejsze liczby konta i ostatnie wyniki bez nadmiaru metryk.</p>
        </div>
        <div className="quick-links">
          <Link className="button ghost" to="/dashboard">
            Wroc do terminala
          </Link>
          <Link className="button ghost" to="/market">
            Szukaj instrumentow
          </Link>
        </div>
      </div>

      <div className="card summary-grid">
        <div>
          <p className="muted">Balance</p>
          <h2>{formatUsd(portfolio.balance, 2)}</h2>
        </div>
        <div>
          <p className="muted">Equity</p>
          <h2>{formatUsd(portfolio.equity, 2)}</h2>
        </div>
        <div>
          <p className="muted">Free margin</p>
          <h2>{formatUsd(stats.freeMargin, 2)}</h2>
        </div>
        <div>
          <p className="muted">Used margin</p>
          <h2>{formatUsd(portfolio.usedMargin, 2)}</h2>
        </div>
        <div>
          <p className="muted">Open positions</p>
          <h2>{stats.positionsCount}</h2>
        </div>
        <div>
          <p className="muted">Open P&L</p>
          <h2 className={stats.unrealizedPnl >= 0 ? 'pnl-positive' : 'pnl-negative'}>{formatUsd(stats.unrealizedPnl, 2)}</h2>
        </div>
      </div>

      <PositionList positions={portfolio.positions || []} showRealized={false} title="Pozycje otwarte" />

      <div className="card">
        <div className="panel-head">
          <h3>Ostatnie transakcje</h3>
          <span className="muted">{trades.length}</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Czas</th>
                <th>Symbol</th>
                <th>Side</th>
                <th>Qty</th>
                <th>Cena (USD)</th>
                <th>P&L</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentTrades.length === 0 && (
                <tr>
                  <td colSpan={6}>Brak transakcji</td>
                </tr>
              )}
              {stats.recentTrades.map((trade) => (
                <tr key={trade.id}>
                  <td>{formatDateTime(trade.executedAt)}</td>
                  <td>{trade.symbol}</td>
                  <td>
                    <span className={`trade-side ${trade.side === 'BUY' ? 'buy' : 'sell'}`}>{trade.side}</span>
                  </td>
                  <td>{Number(trade.quantity).toFixed(2)}</td>
                  <td>{formatUsd(trade.price, 4)}</td>
                  <td className={Number(trade.realizedPnl) >= 0 ? 'pnl-positive' : 'pnl-negative'}>
                    {formatUsd(trade.realizedPnl, 2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {loading && <p className="card">Ladowanie danych portfolio...</p>}
      {error && <p className="card error">{error}</p>}
    </div>
  );
}

export default Portfolio;
