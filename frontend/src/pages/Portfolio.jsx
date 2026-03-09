import { useEffect, useMemo, useState } from 'react';
import PositionList from '../components/PositionList';
import api from '../services/api';
import { formatPercent, formatUsd } from '../utils/formatters';

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
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

function Portfolio({ accountId }) {
  const [portfolio, setPortfolio] = useState(EMPTY_PORTFOLIO);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!accountId) {
      return;
    }

    const load = async () => {
      setLoading(true);
      setError('');

      const [portfolioRes, tradesRes] = await Promise.allSettled([
        api.get(`/api/accounts/${accountId}/portfolio`),
        api.get(`/api/accounts/${accountId}/trades`),
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
        setError((prev) => prev || 'Nie udalo sie pobrac historii transakcji.');
      }

      setLoading(false);
    };

    load().catch(() => {
      setLoading(false);
      setPortfolio(EMPTY_PORTFOLIO);
      setTrades([]);
      setError('Nie udalo sie pobrac danych portfela.');
    });
  }, [accountId]);

  const stats = useMemo(() => {
    const positions = portfolio?.positions || [];
    const unrealizedPnl = sumBy(positions, (item) => item.unrealizedPnl);
    const realizedPnl = sumBy(trades, (item) => item.realizedPnl);
    const equity = Number(portfolio?.equity || 0);
    const usedMargin = Number(portfolio?.usedMargin || 0);
    const freeMargin = equity - usedMargin;
    const marginLevel = usedMargin > 0 ? (equity / usedMargin) * 100 : null;
    const grossProfit = sumBy(
      trades.filter((trade) => Number(trade.realizedPnl) > 0),
      (item) => item.realizedPnl,
    );
    const grossLoss = Math.abs(
      sumBy(
        trades.filter((trade) => Number(trade.realizedPnl) < 0),
        (item) => item.realizedPnl,
      ),
    );
    const closedTrades = trades.filter((trade) => Number(trade.realizedPnl) !== 0);
    const winningTrades = closedTrades.filter((trade) => Number(trade.realizedPnl) > 0).length;
    const winRate = closedTrades.length > 0 ? (winningTrades / closedTrades.length) * 100 : 0;
    const exposure = sumBy(positions, (item) => Math.abs(Number(item.quantity) * Number(item.currentPrice)));

    return {
      unrealizedPnl,
      realizedPnl,
      freeMargin,
      marginLevel,
      winRate,
      grossProfit,
      grossLoss,
      positionsCount: positions.length,
      tradesCount: trades.length,
      exposure,
    };
  }, [portfolio, trades]);

  if (!accountId) {
    return <p>Brak accountId. Zaloguj sie ponownie.</p>;
  }

  return (
    <div className="stack">
      <div className="card">
        <h2>Portfolio</h2>
        <p className="muted">Podsumowanie konta, otwartych pozycji i historii transakcji.</p>
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
          <p className="muted">Unrealized P&L</p>
          <h2 className={stats.unrealizedPnl >= 0 ? 'pnl-positive' : 'pnl-negative'}>{formatUsd(stats.unrealizedPnl, 2)}</h2>
        </div>
        <div>
          <p className="muted">Realized P&L</p>
          <h2 className={stats.realizedPnl >= 0 ? 'pnl-positive' : 'pnl-negative'}>{formatUsd(stats.realizedPnl, 2)}</h2>
        </div>
        <div>
          <p className="muted">Win rate</p>
          <h2>{formatPercent(stats.winRate, 2)}</h2>
        </div>
        <div>
          <p className="muted">Margin level</p>
          <h2>{stats.marginLevel == null ? 'Brak' : formatPercent(stats.marginLevel, 2)}</h2>
        </div>
        <div>
          <p className="muted">Open positions</p>
          <h2>{stats.positionsCount}</h2>
        </div>
        <div>
          <p className="muted">Trades</p>
          <h2>{stats.tradesCount}</h2>
        </div>
        <div>
          <p className="muted">Gross profit</p>
          <h2 className="pnl-positive">{formatUsd(stats.grossProfit, 2)}</h2>
        </div>
        <div>
          <p className="muted">Gross loss</p>
          <h2 className="pnl-negative">{formatUsd(-stats.grossLoss, 2)}</h2>
        </div>
      </div>

      <div className="card portfolio-kpis">
        <div>
          <p className="muted">Ekspozycja laczna</p>
          <h3>{formatUsd(stats.exposure, 2)}</h3>
        </div>
        <div>
          <p className="muted">Status margin call</p>
          <h3 className={portfolio.marginCall ? 'pnl-negative' : 'pnl-positive'}>
            {portfolio.marginCall ? 'UWAGA' : 'OK'}
          </h3>
        </div>
      </div>

      <PositionList positions={portfolio.positions || []} showExposure title="Pozycje otwarte" />

      <div className="card">
        <h3>Historia transakcji</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Czas</th>
                <th>ID</th>
                <th>Order ID</th>
                <th>Symbol</th>
                <th>Side</th>
                <th>Qty</th>
                <th>Cena (USD)</th>
                <th>Realized P&L</th>
              </tr>
            </thead>
            <tbody>
              {trades.length === 0 && (
                <tr>
                  <td colSpan={8}>Brak transakcji</td>
                </tr>
              )}
              {trades.map((trade) => (
                <tr key={trade.id}>
                  <td>{formatDateTime(trade.executedAt)}</td>
                  <td>{trade.id}</td>
                  <td>{trade.orderId}</td>
                  <td>{trade.symbol}</td>
                  <td>
                    <span className={`trade-side ${trade.side === 'BUY' ? 'buy' : 'sell'}`}>{trade.side}</span>
                  </td>
                  <td>{Number(trade.quantity).toFixed(4)}</td>
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
