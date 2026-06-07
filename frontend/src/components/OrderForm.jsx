import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { formatPln, formatUsd } from '../utils/formatters';

const SIZE_PRESETS = ['0.1', '1', '5'];

const toNumberOrNull = (value) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const toInputValue = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? String(numeric) : '';
};

function OrderForm({ symbol, accountId, lastPrice = 0, position = null, disabledReason = '', onOrderPlaced, onRiskUpdated }) {
  const [side, setSide] = useState('BUY');
  const [quantity, setQuantity] = useState('1');
  const [takeProfit, setTakeProfit] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const numericQuantity = Number(quantity);
  const referencePrice = useMemo(() => {
    const fallbackPrice = Number(lastPrice);
    return Number.isFinite(fallbackPrice) ? fallbackPrice : 0;
  }, [lastPrice]);
  const estimatedValue = useMemo(() => {
    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0 || !Number.isFinite(referencePrice) || referencePrice <= 0) {
      return 0;
    }
    return numericQuantity * referencePrice;
  }, [numericQuantity, referencePrice]);
  const hasReferencePrice = Number.isFinite(referencePrice) && referencePrice > 0;
  const positionMatchesSymbol = String(position?.symbol || '').toUpperCase() === String(symbol || '').toUpperCase();
  const positionQuantity = Number(position?.quantity || 0);
  const hasOpenPosition = positionMatchesSymbol && Number.isFinite(positionQuantity) && positionQuantity !== 0;
  const positionRiskSide = positionQuantity < 0 ? 'SELL' : 'BUY';
  const positionLabel = positionQuantity < 0 ? 'SHORT' : 'LONG';
  const inputTakeProfit = toNumberOrNull(takeProfit);
  const inputStopLoss = toNumberOrNull(stopLoss);
  const currentTakeProfit = hasOpenPosition ? toNumberOrNull(position?.takeProfit) : null;
  const currentStopLoss = hasOpenPosition ? toNumberOrNull(position?.stopLoss) : null;
  const hasRiskChanges = hasOpenPosition && (inputTakeProfit !== currentTakeProfit || inputStopLoss !== currentStopLoss);
  const shouldAttachRiskToOrder = !hasOpenPosition;
  const canSubmit =
    !disabledReason &&
    accountId &&
    hasReferencePrice &&
    (hasRiskChanges || (Number.isFinite(numericQuantity) && numericQuantity > 0));

  useEffect(() => {
    setSide('BUY');
    setQuantity('1');
    setError('');
    setSuccess('');
  }, [symbol]);

  useEffect(() => {
    setTakeProfit(positionMatchesSymbol ? toInputValue(position?.takeProfit) : '');
    setStopLoss(positionMatchesSymbol ? toInputValue(position?.stopLoss) : '');
  }, [position?.stopLoss, position?.takeProfit, positionMatchesSymbol, symbol]);

  const validateRiskValues = (riskSide, riskReferencePrice) => {
    const nextTakeProfit = toNumberOrNull(takeProfit);
    const nextStopLoss = toNumberOrNull(stopLoss);

    if (!riskReferencePrice || riskReferencePrice <= 0) {
      return 'Brak ceny referencyjnej dla SL/TP.';
    }
    if (nextTakeProfit != null && nextTakeProfit <= 0) {
      return 'Take Profit musi byc wiekszy od 0.';
    }
    if (nextStopLoss != null && nextStopLoss <= 0) {
      return 'Stop Loss musi byc wiekszy od 0.';
    }
    if (nextTakeProfit != null) {
      if (riskSide === 'BUY' && nextTakeProfit <= riskReferencePrice) {
        return 'Dla BUY Take Profit musi byc powyzej ceny wejscia.';
      }
      if (riskSide === 'SELL' && nextTakeProfit >= riskReferencePrice) {
        return 'Dla SELL Take Profit musi byc ponizej ceny wejscia.';
      }
    }
    if (nextStopLoss != null) {
      if (riskSide === 'BUY' && nextStopLoss >= riskReferencePrice) {
        return 'Dla BUY Stop Loss musi byc ponizej ceny wejscia.';
      }
      if (riskSide === 'SELL' && nextStopLoss <= riskReferencePrice) {
        return 'Dla SELL Stop Loss musi byc powyzej ceny wejscia.';
      }
    }

    return '';
  };

  const validateOrder = () => {
    if (!accountId) {
      return 'Brak accountId. Zaloguj sie ponownie.';
    }
    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
      return 'Podaj dodatni wolumen.';
    }
    return shouldAttachRiskToOrder ? validateRiskValues(side, referencePrice) : '';
  };

  const validateRiskUpdate = () => {
    if (!accountId) {
      return 'Brak accountId. Zaloguj sie ponownie.';
    }
    if (!hasOpenPosition) {
      return 'Brak otwartej pozycji dla tego instrumentu.';
    }
    return validateRiskValues(positionRiskSide, referencePrice);
  };

  const handleSuccess = async (data) => {
    setSuccess(
      data.status === 'FILLED'
        ? `Zlecenie wykonane po ${formatUsd(data.filledPrice ?? referencePrice, 4)}.`
        : `Zlecenie zapisane ze statusem ${data.status}.`,
    );
    setError('');
    await onOrderPlaced?.(data);
  };

  const submitOrder = async (event) => {
    event.preventDefault();
    if (hasRiskChanges) {
      await updatePositionRisk();
      return;
    }

    const validationMessage = validateOrder();
    if (validationMessage) {
      setError(validationMessage);
      setSuccess('');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const { data } = await api.post('/api/orders', {
        accountId,
        symbol,
        side,
        type: 'MARKET',
        quantity: Number(quantity),
        takeProfit: shouldAttachRiskToOrder ? inputTakeProfit : null,
        stopLoss: shouldAttachRiskToOrder ? inputStopLoss : null,
        limitPrice: null,
      });
      await handleSuccess(data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Nie mozna zlozyc zlecenia.');
      setSuccess('');
    } finally {
      setLoading(false);
    }
  };

  const updatePositionRisk = async () => {
    const validationMessage = validateRiskUpdate();
    if (validationMessage) {
      setError(validationMessage);
      setSuccess('');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        takeProfit: inputTakeProfit,
        stopLoss: inputStopLoss,
      };
      const { data } = await api.patch(`/api/accounts/${accountId}/positions/${encodeURIComponent(symbol)}/risk`, payload);
      setSuccess(payload.takeProfit || payload.stopLoss ? 'SL/TP zapisane dla pozycji.' : 'SL/TP wyczyszczone dla pozycji.');
      await onRiskUpdated?.(data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Nie mozna zapisac SL/TP.');
      setSuccess('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card trade-card">
      <div className="panel-head">
        <div>
          <h3>Order Ticket</h3>
          <p className="muted">{symbol}</p>
        </div>
        {hasOpenPosition && (
          <span className="status-pill is-live">
            {positionLabel} {Math.abs(positionQuantity).toFixed(2)}
          </span>
        )}
      </div>

      {disabledReason ? (
        <div className="trade-disabled-state">
          <span className="status-pill">W trakcie pracy</span>
          <p className="muted">{disabledReason}</p>
        </div>
      ) : (
        <>
      <div className="segmented-control side-toggle">
        <button
          className={`button ghost segment-btn segment-buy ${side === 'BUY' ? 'is-side-active' : ''}`}
          type="button"
          onClick={() => setSide('BUY')}
        >
          BUY
        </button>
        <button
          className={`button ghost segment-btn segment-sell ${side === 'SELL' ? 'is-side-active' : ''}`}
          type="button"
          onClick={() => setSide('SELL')}
        >
          SELL
        </button>
      </div>

      <form className="trade-form" onSubmit={submitOrder}>
        <div className="form-grid order-fields">
          <label className="volume-field">
            Wolumen
            <input type="number" min="0.0001" step="0.0001" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            <span className="field-hint">Wartosc pozycji: {formatPln(estimatedValue, 2)}</span>
          </label>

          <label>
            Take Profit
            <input
              type="number"
              min="0.0001"
              step="0.0001"
              value={takeProfit}
              placeholder="opcjonalnie"
              onChange={(event) => setTakeProfit(event.target.value)}
            />
          </label>

          <label>
            Stop Loss
            <input
              type="number"
              min="0.0001"
              step="0.0001"
              value={stopLoss}
              placeholder="opcjonalnie"
              onChange={(event) => setStopLoss(event.target.value)}
            />
          </label>
        </div>

        <div className="order-presets">
          <span className="muted">Szybki wolumen</span>
          <div className="preset-row">
            {SIZE_PRESETS.map((preset) => (
              <button key={preset} className="button ghost" type="button" onClick={() => setQuantity(preset)}>
                {preset}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="error">{error}</p>}
        {success && <p className="success-text">{success}</p>}

        <div className="row-actions trade-actions">
          <button className="button" type="submit" disabled={!canSubmit || loading}>
            {loading ? 'Wysylanie...' : 'Potwierdz'}
          </button>
        </div>
      </form>
        </>
      )}
    </div>
  );
}

export default OrderForm;
