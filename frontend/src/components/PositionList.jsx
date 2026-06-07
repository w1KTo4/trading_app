import { useEffect, useState } from 'react';
import { formatPercent, formatPln, formatUsd } from '../utils/formatters';

const formatVolume = (value) => {
  const numeric = Math.abs(Number(value || 0));
  if (!Number.isFinite(numeric)) {
    return '0';
  }
  const digits = numeric < 1 ? 4 : 2;
  return numeric.toFixed(digits).replace(/\.?0+$/, '');
};

const formatOptionalPrice = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? formatUsd(numeric, 4) : '-';
};

const toInputValue = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? String(numeric) : '';
};

const toNumberOrNull = (value) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

function PositionList({
  positions = [],
  accountMetrics = null,
  title = 'Pozycje',
  showAccountStrip = true,
  emptyLabel = 'Brak otwartych pozycji',
  editableRisk = false,
  onClosePosition,
  onUpdateRisk,
}) {
  const [riskDrafts, setRiskDrafts] = useState({});
  const [pendingSymbol, setPendingSymbol] = useState('');
  const canManage = Boolean(onClosePosition || onUpdateRisk);

  useEffect(() => {
    setRiskDrafts((previous) => {
      const next = {};
      positions.forEach((position) => {
        const symbol = position.symbol;
        next[symbol] = previous[symbol] || {
          stopLoss: toInputValue(position.stopLoss),
          takeProfit: toInputValue(position.takeProfit),
        };
      });
      return next;
    });
  }, [positions]);

  const sortedPositions = [...positions].sort((left, right) => {
    const leftExposure = Math.abs(Number(left.quantity || 0) * Number(left.currentPrice || 0));
    const rightExposure = Math.abs(Number(right.quantity || 0) * Number(right.currentPrice || 0));
    if (rightExposure !== leftExposure) {
      return rightExposure - leftExposure;
    }
    return left.symbol.localeCompare(right.symbol);
  });
  const fallbackValue = sortedPositions.reduce(
    (acc, position) => acc + Math.abs(Number(position.quantity || 0) * Number(position.currentPrice || 0)),
    0,
  );
  const fallbackPnl = sortedPositions.reduce((acc, position) => acc + Number(position.unrealizedPnl || 0), 0);
  const metrics = {
    totalValue: fallbackValue,
    usedMargin: 0,
    marginLevel: null,
    freeMargin: 0,
    netProfit: fallbackPnl,
    ...accountMetrics,
  };

  const updateDraft = (symbol, field, value) => {
    setRiskDrafts((previous) => ({
      ...previous,
      [symbol]: {
        stopLoss: '',
        takeProfit: '',
        ...previous[symbol],
        [field]: value,
      },
    }));
  };

  const saveRisk = async (position) => {
    if (!onUpdateRisk) {
      return;
    }
    const draft = riskDrafts[position.symbol] || {};
    setPendingSymbol(position.symbol);
    try {
      await onUpdateRisk(position, {
        stopLoss: toNumberOrNull(draft.stopLoss),
        takeProfit: toNumberOrNull(draft.takeProfit),
      });
    } finally {
      setPendingSymbol('');
    }
  };

  const closePosition = async (position) => {
    if (!onClosePosition) {
      return;
    }
    if (!window.confirm(`Zamknac pozycje ${position.symbol}?`)) {
      return;
    }
    setPendingSymbol(position.symbol);
    try {
      await onClosePosition(position);
    } finally {
      setPendingSymbol('');
    }
  };

  return (
    <div className="card positions-card">
      <div className="panel-head positions-head">
        <h3>{title}</h3>
        <span className="muted">{sortedPositions.length}</span>
      </div>

      <div className="table-wrap positions-table-wrap">
        <table className="table positions-table">
          <thead>
            <tr>
              <th>Instrument/Pozycja</th>
              <th>Wolumen</th>
              <th>Wartosc</th>
              <th>Aktualna cena</th>
              <th>Cena otwarcia</th>
              <th>Stop Loss</th>
              <th>Take Profit</th>
              <th>Zysk netto %</th>
              <th>Zysk netto</th>
              {canManage && <th>Akcje</th>}
            </tr>
          </thead>
          <tbody>
            {sortedPositions.length === 0 && (
              <tr>
                <td colSpan={canManage ? 10 : 9}>{emptyLabel}</td>
              </tr>
            )}
            {sortedPositions.map((position) => {
              const quantity = Number(position.quantity || 0);
              const currentPrice = Number(position.currentPrice || 0);
              const averagePrice = Number(position.averagePrice || 0);
              const positionValue = Math.abs(quantity * currentPrice);
              const entryValue = Math.abs(quantity * averagePrice);
              const netProfit = Number(position.unrealizedPnl || 0);
              const netPercent = entryValue > 0 ? (netProfit / entryValue) * 100 : 0;
              const direction = quantity >= 0 ? 'long' : 'short';
              const draft = riskDrafts[position.symbol] || {
                stopLoss: toInputValue(position.stopLoss),
                takeProfit: toInputValue(position.takeProfit),
              };
              const pending = pendingSymbol === position.symbol;
              const riskChanged =
                toNumberOrNull(draft.stopLoss) !== toNumberOrNull(position.stopLoss) ||
                toNumberOrNull(draft.takeProfit) !== toNumberOrNull(position.takeProfit);

              return (
                <tr key={position.id ?? position.orderId ?? position.symbol}>
                  <td>
                    <div className="position-instrument">
                      <span className={`instrument-badge ${direction}`}>{position.symbol.slice(0, 2)}</span>
                      <span>
                        <strong>{position.symbol}</strong>
                        <small className="pill-tag compact-tag">CFD</small>
                      </span>
                    </div>
                  </td>
                  <td>{formatVolume(quantity)}</td>
                  <td>{formatPln(positionValue, 2)}</td>
                  <td>{formatUsd(currentPrice, 4)}</td>
                  <td>{formatUsd(averagePrice, 4)}</td>
                  <td>
                    {editableRisk ? (
                      <input
                        className="position-risk-input"
                        type="number"
                        min="0.0001"
                        step="0.0001"
                        value={draft.stopLoss}
                        placeholder="-"
                        disabled={pending}
                        onChange={(event) => updateDraft(position.symbol, 'stopLoss', event.target.value)}
                      />
                    ) : (
                      formatOptionalPrice(position.stopLoss)
                    )}
                  </td>
                  <td>
                    {editableRisk ? (
                      <input
                        className="position-risk-input"
                        type="number"
                        min="0.0001"
                        step="0.0001"
                        value={draft.takeProfit}
                        placeholder="-"
                        disabled={pending}
                        onChange={(event) => updateDraft(position.symbol, 'takeProfit', event.target.value)}
                      />
                    ) : (
                      formatOptionalPrice(position.takeProfit)
                    )}
                  </td>
                  <td className={netProfit >= 0 ? 'pnl-positive' : 'pnl-negative'}>{formatPercent(netPercent, 2)}</td>
                  <td className={netProfit >= 0 ? 'pnl-positive' : 'pnl-negative'}>{formatPln(netProfit, 2)}</td>
                  {canManage && (
                    <td>
                      <div className="position-actions">
                        {editableRisk && onUpdateRisk && (
                          <button
                            className="position-icon-btn save"
                            type="button"
                            title="Zapisz TP/SL"
                            disabled={pending || !riskChanged}
                            onClick={() => saveRisk(position)}
                          >
                            OK
                          </button>
                        )}
                        {onClosePosition && (
                          <button
                            className="position-icon-btn close"
                            type="button"
                            title="Zamknij pozycje"
                            disabled={pending}
                            onClick={() => closePosition(position)}
                          >
                            X
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showAccountStrip && (
        <div className="position-account-strip">
          <span>
            Wartosc moich transakcji <strong>{formatPln(metrics.totalValue, 2)}</strong>
          </span>
          <span>
            Depozyt zabezpieczajacy <strong>{formatPln(metrics.usedMargin, 2)}</strong>
          </span>
          <span>
            Poziom depozytu <strong>{Number.isFinite(Number(metrics.marginLevel)) ? formatPercent(metrics.marginLevel, 2) : '-'}</strong>
          </span>
          <span>
            Wolne srodki <strong>{formatPln(metrics.freeMargin, 2)}</strong>
          </span>
          <span className="position-strip-profit">
            Zysk{' '}
            <strong className={Number(metrics.netProfit) >= 0 ? 'pnl-positive' : 'pnl-negative'}>
              {formatPln(metrics.netProfit, 2)}
            </strong>
          </span>
        </div>
      )}
    </div>
  );
}

export default PositionList;
