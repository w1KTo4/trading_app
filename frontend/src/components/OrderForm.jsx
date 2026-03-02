import { useMemo, useState } from 'react';
import api from '../services/api';

function OrderForm({ symbol, accountId, onOrderPlaced }) {
  const [side, setSide] = useState('BUY');
  const [type, setType] = useState('MARKET');
  const [quantity, setQuantity] = useState('1');
  const [limitPrice, setLimitPrice] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = useMemo(() => Number(quantity) > 0 && accountId, [quantity, accountId]);

  const submitOrder = async (event) => {
    event.preventDefault();
    if (!accountId) {
      setError('Brak accountId (zaloguj sie ponownie).');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const payload = {
        accountId,
        symbol,
        side,
        type,
        quantity: Number(quantity),
        takeProfit: takeProfit ? Number(takeProfit) : null,
        stopLoss: stopLoss ? Number(stopLoss) : null,
        limitPrice: type === 'LIMIT' ? Number(limitPrice) : null,
      };

      const { data } = await api.post('/api/orders', payload);
      onOrderPlaced?.(data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Nie mozna zlozyc zlecenia.');
    } finally {
      setLoading(false);
    }
  };

  const quickMarketBuy = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = {
        accountId,
        symbol,
        side: 'BUY',
        type: 'MARKET',
        quantity: 1,
      };
      const { data } = await api.post('/api/orders', payload);
      onOrderPlaced?.(data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Nie mozna zlozyc szybkiego zlecenia.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h3>Zlecenie</h3>
      <form className="form-grid" onSubmit={submitOrder}>
        <label>
          Side
          <select value={side} onChange={(e) => setSide(e.target.value)}>
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </select>
        </label>

        <label>
          Type
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="MARKET">MARKET</option>
            <option value="LIMIT">LIMIT</option>
          </select>
        </label>

        <label>
          Quantity
          <input type="number" step="0.0001" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </label>

        {type === 'LIMIT' && (
          <label>
            Limit price
            <input type="number" step="0.0001" value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} />
          </label>
        )}

        <label>
          Take profit
          <input type="number" step="0.0001" value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} />
        </label>

        <label>
          Stop loss
          <input type="number" step="0.0001" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} />
        </label>

        {error && <p className="error">{error}</p>}

        <div className="row-actions">
          <button className="button" type="submit" disabled={!canSubmit || loading}>
            {loading ? 'Wysylanie...' : 'Zloz zlecenie'}
          </button>
          <button className="button ghost" type="button" onClick={quickMarketBuy} disabled={!canSubmit || loading}>
            Quick MARKET BUY
          </button>
        </div>
      </form>
    </div>
  );
}

export default OrderForm;
