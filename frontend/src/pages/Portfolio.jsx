import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import PositionList from '../components/PositionList';
import api from '../services/api';
import { formatPln, formatUsd } from '../utils/formatters';
import useMarketFocus from '../hooks/useMarketFocus';
import { useWebSocketData } from '../ws/useWebSocketData';

const EMPTY_PORTFOLIO = {
  balance: 0,
  equity: 0,
  usedMargin: 0,
  positions: [],
};

const EMPTY_FUNDING = {
  paymentRequests: [],
  walletTransactions: [],
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
  const { paymentEvents } = useWebSocketData();
  const [activeAccountId, setActiveAccountId] = useState(accountId);
  const [portfolio, setPortfolio] = useState(EMPTY_PORTFOLIO);
  const [funding, setFunding] = useState(EMPTY_FUNDING);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fundingMessage, setFundingMessage] = useState('');
  const [fundingError, setFundingError] = useState('');
  const [depositCode, setDepositCode] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawNote, setWithdrawNote] = useState('');
  const [fundingLoading, setFundingLoading] = useState(false);
  const activeAccountIdRef = useRef(accountId);
  const lastProcessedPaymentEventRef = useRef('');

  useEffect(() => {
    setActiveAccountId(accountId);
  }, [accountId]);

  useEffect(() => {
    activeAccountIdRef.current = activeAccountId;
  }, [activeAccountId]);

  const loadPortfolio = useCallback(
    async (preferredAccountId) => {
      const requestedAccountId = Number(preferredAccountId || activeAccountIdRef.current || accountId || 0);
      if (!requestedAccountId) {
        return;
      }

      setLoading(true);
      setError('');

      try {
        let resolvedAccountId = requestedAccountId;
        const profileRes = await api.get('/api/auth/me');
        const profileAccountIds = profileRes.data?.accountIds || [];
        if (profileAccountIds.length > 0 && !profileAccountIds.includes(requestedAccountId)) {
          resolvedAccountId = profileAccountIds[0];
          onAccountChange?.(resolvedAccountId);
        }

        setActiveAccountId(resolvedAccountId);

        const [portfolioRes, tradesRes, fundingRes] = await Promise.allSettled([
          api.get(`/api/accounts/${resolvedAccountId}/portfolio`),
          api.get(`/api/accounts/${resolvedAccountId}/trades`),
          api.get(`/api/accounts/${resolvedAccountId}/funding`),
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

        if (fundingRes.status === 'fulfilled') {
          setFunding(fundingRes.value.data || EMPTY_FUNDING);
        } else {
          setFunding(EMPTY_FUNDING);
          setError((previous) => previous || 'Nie udalo sie pobrac historii finansowania.');
        }
      } catch {
        setPortfolio(EMPTY_PORTFOLIO);
        setTrades([]);
        setFunding(EMPTY_FUNDING);
        setError('Nie udalo sie pobrac danych portfela.');
      } finally {
        setLoading(false);
      }
    },
    [accountId, onAccountChange],
  );

  useEffect(() => {
    if (!accountId) {
      return;
    }
    loadPortfolio(accountId);
  }, [accountId, loadPortfolio]);

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

    if (!eventKey || eventKey === lastProcessedPaymentEventRef.current) {
      return;
    }

    if (latestEvent.accountId && Number(latestEvent.accountId) !== Number(activeAccountIdRef.current)) {
      return;
    }

    lastProcessedPaymentEventRef.current = eventKey;
    loadPortfolio(activeAccountIdRef.current);

    if (latestEvent.type === 'PAYMENT_FINALIZED') {
      if (String(latestEvent.status || '').toUpperCase() === 'CONFIRMED') {
        setFundingMessage(`Wplata ${formatPln(latestEvent.amount, 2)} potwierdzona.`);
        setFundingError('');
      } else {
        setFundingError(`Wplata zakonczona statusem ${latestEvent.status}.`);
      }
    }

    if (latestEvent.type === 'WITHDRAWAL_COMPLETED') {
      setFundingMessage(`Wyplata ${formatPln(Math.abs(Number(latestEvent.amount || 0)), 2)} zakonczona.`);
      setFundingError('');
    }
  }, [loadPortfolio, paymentEvents]);

  useMarketFocus((portfolio.positions || []).slice(0, 6).map((position) => position.symbol));

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
      recentTrades: trades.slice(0, 10),
      realizedPnl: sumBy(trades.slice(0, 10), (trade) => trade.realizedPnl),
      recentFunding: (funding.walletTransactions || []).slice(0, 12),
      pendingPayments: (funding.paymentRequests || []).filter((entry) => entry.status === 'SUBMITTED').slice(0, 8),
    };
  }, [funding.paymentRequests, funding.walletTransactions, portfolio, trades]);

  const submitTrustPayDeposit = async (event) => {
    event.preventDefault();
    const normalizedCode = String(depositCode || '').replace(/\D/g, '').slice(0, 6);
    const amount = Number(depositAmount);

    if (!/^\d{6}$/.test(normalizedCode)) {
      setFundingError('Kod TrustPay musi miec dokladnie 6 cyfr.');
      setFundingMessage('');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setFundingError('Podaj poprawna kwote w PLN.');
      setFundingMessage('');
      return;
    }

    setFundingLoading(true);
    setFundingError('');
    setFundingMessage('');

    try {
      const { data } = await api.post(`/api/accounts/${activeAccountIdRef.current}/funding/trustpay/submit-code`, {
        code: normalizedCode,
        amount,
      });

      setDepositCode('');
      setDepositAmount('');
      setFundingMessage(`Kod wyslany. Oczekiwanie na webhook TrustPay. CorrelationId: ${data.correlationId}`);
      await loadPortfolio(activeAccountIdRef.current);
    } catch (requestError) {
      setFundingError(requestError.response?.data?.message || 'Nie udalo sie wyslac kodu TrustPay.');
    } finally {
      setFundingLoading(false);
    }
  };

  const submitWithdrawal = async (event) => {
    event.preventDefault();
    const amount = Number(withdrawAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setFundingError('Podaj poprawna kwote wyplaty.');
      setFundingMessage('');
      return;
    }

    setFundingLoading(true);
    setFundingError('');
    setFundingMessage('');

    try {
      await api.post(`/api/accounts/${activeAccountIdRef.current}/funding/withdraw`, {
        amount,
        note: withdrawNote || null,
      });
      setWithdrawAmount('');
      setWithdrawNote('');
      setFundingMessage('Wyplata zakonczona pomyslnie.');
      await loadPortfolio(activeAccountIdRef.current);
    } catch (requestError) {
      setFundingError(requestError.response?.data?.message || 'Nie udalo sie wykonac wyplaty.');
    } finally {
      setFundingLoading(false);
    }
  };

  if (!activeAccountId) {
    return <p>Brak accountId. Zaloguj sie ponownie.</p>;
  }

  return (
    <div className="stack">
      <div className="card quick-actions-bar hero-card">
        <div>
          <p className="eyebrow">Portfolio intelligence</p>
          <h2>Portfolio</h2>
          <p className="muted">Najwazniejsze liczby konta, ryzyko i wynik ostatnich transakcji.</p>
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

      <div className="summary-grid summary-grid-rich">
        <div className="card summary-card">
          <p className="muted">Balance</p>
          <h2>{formatPln(portfolio.balance, 2)}</h2>
          <span className="summary-note">Kapital gotowkowy na rachunku.</span>
        </div>
        <div className="card summary-card">
          <p className="muted">Equity</p>
          <h2>{formatPln(portfolio.equity, 2)}</h2>
          <span className={`summary-note ${stats.unrealizedPnl >= 0 ? 'pnl-positive' : 'pnl-negative'}`}>
            Open P&L {formatPln(stats.unrealizedPnl, 2)}
          </span>
        </div>
        <div className="card summary-card">
          <p className="muted">Free margin</p>
          <h2>{formatPln(stats.freeMargin, 2)}</h2>
          <span className="summary-note">Srodki dostepne do nowych wejsc.</span>
        </div>
        <div className="card summary-card">
          <p className="muted">Used margin</p>
          <h2>{formatPln(portfolio.usedMargin, 2)}</h2>
          <span className="summary-note">Kapital zaangazowany w pozycje.</span>
        </div>
        <div className="card summary-card">
          <p className="muted">Open positions</p>
          <h2>{stats.positionsCount}</h2>
          <span className="summary-note">Aktywne ekspozycje do monitorowania.</span>
        </div>
        <div className="card summary-card">
          <p className="muted">Recent realized P&L</p>
          <h2 className={stats.realizedPnl >= 0 ? 'pnl-positive' : 'pnl-negative'}>{formatPln(stats.realizedPnl, 2)}</h2>
          <span className="summary-note">Suma z ostatnich 10 trade'ow.</span>
        </div>
      </div>

      <div className="card">
        <div className="panel-head">
          <div>
            <h3>Wplaty i wyplaty</h3>
            <p className="muted">Doladuj konto kodem TrustPay albo wykonaj wyplate z salda.</p>
          </div>
        </div>

        <div className="form-grid">
          <form onSubmit={submitTrustPayDeposit}>
            <label>
              Kod TrustPay (6 cyfr)
              <input
                type="text"
                inputMode="numeric"
                value={depositCode}
                onChange={(event) => setDepositCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
              />
            </label>
            <label>
              Kwota wplaty (PLN)
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={depositAmount}
                onChange={(event) => setDepositAmount(event.target.value)}
                placeholder="0.00"
              />
            </label>
            <button className="button" type="submit" disabled={fundingLoading}>
              {fundingLoading ? 'Wysylanie...' : 'Wyslij kod TrustPay'}
            </button>
          </form>

          <form onSubmit={submitWithdrawal}>
            <label>
              Kwota wyplaty (PLN)
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={withdrawAmount}
                onChange={(event) => setWithdrawAmount(event.target.value)}
                placeholder="0.00"
              />
            </label>
            <label>
              Opis (opcjonalnie)
              <input
                type="text"
                value={withdrawNote}
                onChange={(event) => setWithdrawNote(event.target.value)}
                placeholder="np. wyplata testowa"
              />
            </label>
            <button className="button ghost" type="submit" disabled={fundingLoading}>
              {fundingLoading ? 'Przetwarzanie...' : 'Wyplac srodki'}
            </button>
          </form>
        </div>

        {!!stats.pendingPayments.length && (
          <div className="mini-stat-grid">
            {stats.pendingPayments.map((payment) => (
              <div className="mini-stat" key={payment.correlationId}>
                <p className="muted">Pending TrustPay</p>
                <strong>{formatPln(payment.amount, 2)}</strong>
                <small className="muted">{payment.correlationId}</small>
              </div>
            ))}
          </div>
        )}

        {fundingMessage && <p className="success-text">{fundingMessage}</p>}
        {fundingError && <p className="error">{fundingError}</p>}
      </div>

      <PositionList positions={portfolio.positions || []} showExposure showRealized={false} title="Pozycje otwarte" />

      <div className="card">
        <div className="panel-head">
          <div>
            <h3>Historia finansowania</h3>
            <p className="muted">Ostatnie operacje gotowkowe na rachunku.</p>
          </div>
          <span className="muted">{stats.recentFunding.length}</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Czas</th>
                <th>Typ</th>
                <th>Kwota (z�)</th>
                <th>Saldo po (z�)</th>
                <th>Zrodlo</th>
                <th>CorrelationId</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentFunding.length === 0 && (
                <tr>
                  <td colSpan={6}>Brak operacji</td>
                </tr>
              )}
              {stats.recentFunding.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDateTime(entry.createdAt)}</td>
                  <td>{entry.type}</td>
                  <td className={Number(entry.amount) >= 0 ? 'pnl-positive' : 'pnl-negative'}>{formatPln(entry.amount, 2)}</td>
                  <td>{formatPln(entry.balanceAfter, 2)}</td>
                  <td>{entry.source}</td>
                  <td>{entry.correlationId || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="panel-head">
          <div>
            <h3>Ostatnie transakcje</h3>
            <p className="muted">Krotka historia wykonanych trade'ow z wynikiem i czasem wejscia.</p>
          </div>
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
                <th>P&amp;L (z�)</th>
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
                  <td>
                    <strong>{trade.symbol}</strong>
                  </td>
                  <td>
                    <span className={`trade-side ${trade.side === 'BUY' ? 'buy' : 'sell'}`}>{trade.side}</span>
                  </td>
                  <td>{Number(trade.quantity).toFixed(2)}</td>
                  <td>{formatUsd(trade.price, 4)}</td>
                  <td className={Number(trade.realizedPnl) >= 0 ? 'pnl-positive' : 'pnl-negative'}>
                    {formatPln(trade.realizedPnl, 2)}
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
  