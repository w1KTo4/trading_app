import { useMemo, useState } from 'react';
import api from '../services/api';
import { formatUsd } from '../utils/formatters';

const SIZE_PRESETS = ['0.1', '1', '5'];

const toNumberOrNull = (value) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

function OrderForm({ symbol, accountId, lastPrice = 0, position = null, onOrderPlaced }) {
  const [side, setSide] = useState('BUY');
  const [type, setType] = useState('MARKET');
  const [quantity, setQuantity] = useState('1');
  const [limitPrice, setLimitPrice] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const numericQuantity = Number(quantity);
  const referencePrice = useMemo(() => {
    if (type === 'LIMIT') {
      return toNumberOrNull(limitPrice) ?? Number(lastPrice) ?? 0;
    }
    return Number(lastPrice) || 0;
  }, [lastPrice, limitPrice, type]);
  const estimatedValue = useMemo(() => {
    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0 || !Number.isFinite(referencePrice) || referencePrice <= 0) {
      return 0;
    }
    return numericQuantity * referencePrice;
  }, [numericQuantity, referencePrice]);
  const canSubmit = useMemo(() => numericQuantity > 0 && accountId, [numericQuantity, accountId]);

  const validateOrder = () => {
    if (!accountId) {
      return 'Brak accountId. Zaloguj sie ponownie.';
    }
    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
      return 'Podaj dodatnia ilosc.';
    }

    const nextLimitPrice = toNumberOrNull(limitPrice);
    const nextTakeProfit = toNumberOrNull(takeProfit);
    const nextStopLoss = toNumberOrNull(stopLoss);
    const nextReferencePrice = type === 'LIMIT' ? nextLimitPrice : referencePrice;

    if (type === 'LIMIT' && (!nextLimitPrice || nextLimitPrice <= 0)) {
      return 'Podaj poprawna cene LIMIT.';
    }
    if (nextTakeProfit != null && nextTakeProfit <= 0) {
      return 'Take profit musi byc wiekszy od 0.';
    }
    if (nextStopLoss != null && nextStopLoss <= 0) {
      return 'Stop loss musi byc wiekszy od 0.';
    }
    if (!nextReferencePrice || nextReferencePrice <= 0) {
      return 'Brak ceny referencyjnej dla zlecenia.';
    }
    if (nextTakeProfit != null) {
      if (side === 'BUY' && nextTakeProfit <= nextReferencePrice) {
        return 'Dla BUY take profit musi byc powyzej ceny wejscia.';
      }
      if (side === 'SELL' && nextTakeProfit >= nextReferencePrice) {
        return 'Dla SELL take profit musi byc ponizej ceny wejscia.';
      }
    }
    if (nextStopLoss != null) {
      if (side === 'BUY' && nextStopLoss >= nextReferencePrice) {
        return 'Dla BUY stop loss musi byc ponizej ceny wejscia.';
      }
      if (side === 'SELL' && nextStopLoss <= nextReferencePrice) {
        return 'Dla SELL stop loss musi byc powyzej ceny wejscia.';
      }
    }

    return '';
  };

  const handleSuccess = async (data) => {
    setSuccess(
      data.status === 'FILLED'
        ? `Zlecenie wykonane po ${formatUsd(data.filledPrice ?? referencePrice, 4)}.`
        : `Zlecenie zapisane ze statusem ${data.status}.`,
    );
    setError('');
    setType('MARKET');
    setLimitPrice('');
    await onOrderPlaced?.(data);
  };

  const submitOrder = async (event) => {
    event.preventDefault();
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
      const payload = {
        accountId,
        symbol,
        side,
        type,
        quantity: Number(quantity),
        takeProfit: toNumberOrNull(takeProfit),
        stopLoss: toNumberOrNull(stopLoss),
        limitPrice: type === 'LIMIT' ? toNumberOrNull(limitPrice) : null,
      };

      const { data } = await api.post('/api/orders', payload);
      await handleSuccess(data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Nie mozna zlozyc zlecenia.');
      setSuccess('');
    } finally {
      setLoading(false);
    }
  };

  const quickMarketOrder = async (nextSide) => {
    if (!accountId) {
      setError('Brak accountId. Zaloguj sie ponownie.');
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
        side: nextSide,
        type: 'MARKET',
        quantity: Number(quantity) > 0 ? Number(quantity) : 1,
      });
      setSide(nextSide);
      await handleSuccess(data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Nie mozna zlozyc szybkiego zlecenia.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card trade-card">
      <div className="panel-head">
        <div>
          <h3>Zlecenie</h3>
          <p className="muted">
            {symbol} - cena orientacyjna {formatUsd(referencePrice || lastPrice || 0, 4)}
          </p>
        </div>
        <span className={`status-pill ${position ? 'is-live' : ''}`}>
          {position ? `Pozycja: ${Number(position.quantity).toFixed(2)}` : 'Brak pozycji'}
        </span>
      </div>

      <div className="segmented-control">
        <button
          className={`button ghost segment-btn ${side === 'BUY' ? 'active-tab' : ''}`}
          type="button"
          onClick={() => setSide('BUY')}
        >
          BUY
        </button>
        <button
          className={`button ghost segment-btn ${side === 'SELL' ? 'active-tab' : ''}`}
          type="button"
          onClick={() => setSide('SELL')}
        >
          SELL
        </button>
      </div>

      <form className="form-grid" onSubmit={submitOrder}>
        <label>
          Typ zlecenia
          <select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="MARKET">MARKET</option>
            <option value="LIMIT">LIMIT</option>
          </select>
        </label>

        <label>
          Ilosc
          <input type="number" min="0.0001" step="0.0001" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
        </label>

        {type === 'LIMIT' && (
          <label>
            Cena LIMIT
            <input
              type="number"
              min="0.0001"
              step="0.0001"
              value={limitPrice}
              placeholder={String(Number(lastPrice || 0).toFixed(4))}
              onChange={(event) => setLimitPrice(event.target.value)}
            />
          </label>
        )}

        <label>
          Take profit
          <input type="number" min="0.0001" step="0.0001" value={takeProfit} onChange={(event) => setTakeProfit(event.target.value)} />
        </label>

        <label>
          Stop loss
          <input type="number" min="0.0001" step="0.0001" value={stopLoss} onChange={(event) => setStopLoss(event.target.value)} />
        </label>

        <div className="order-presets">
          <span className="muted">Szybka ilosc</span>
          <div className="preset-row">
            {SIZE_PRESETS.map((preset) => (
              <button key={preset} className="button ghost" type="button" onClick={() => setQuantity(preset)}>
                {preset}
              </button>
            ))}
          </div>
        </div>

        <div className="order-summary">
          <div>
            <p className="muted">Wartosc orientacyjna</p>
            <strong>{formatUsd(estimatedValue, 2)}</strong>
          </div>
          <div>
            <p className="muted">Tryb</p>
            <strong>{type === 'MARKET' ? 'Wykonanie od razu' : 'Oczekiwanie na limit'}</strong>
          </div>
        </div>

        {error && <p className="error">{error}</p>}
        {success && <p className="success-text">{success}</p>}

        <div className="row-actions trade-actions">
          <button className="button" type="submit" disabled={!canSubmit || loading}>
            {loading ? 'Wysylanie...' : type === 'MARKET' ? 'Zloz zlecenie rynkowe' : 'Zloz zlecenie LIMIT'}
          </button>
          <button className="button ghost" type="button" onClick={() => quickMarketOrder('BUY')} disabled={!canSubmit || loading}>
            Kup po rynku
          </button>
          <button className="button ghost" type="button" onClick={() => quickMarketOrder('SELL')} disabled={!canSubmit || loading}>
            Sprzedaj po rynku
          </button>
        </div>
      </form>
    </div>
  );
}

export default OrderForm;
