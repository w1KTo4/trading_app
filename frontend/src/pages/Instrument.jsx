import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import Chart from '../components/Chart';
import OrderForm from '../components/OrderForm';
import { useWebSocketData } from '../ws/WebSocketProvider';

function Instrument({ accountId }) {
  const { symbol } = useParams();
  const { latestPrices, orderEvents } = useWebSocketData();
  const [instrument, setInstrument] = useState(null);
  const [prices, setPrices] = useState([]);
  const [message, setMessage] = useState('');

  const currentLivePrice = latestPrices[symbol]?.price;

  useEffect(() => {
    const load = async () => {
      const [instrumentRes, pricesRes] = await Promise.all([
        api.get(`/api/instruments/${symbol}`),
        api.get(`/api/instruments/${symbol}/prices?limit=80`),
      ]);
      setInstrument(instrumentRes.data);
      setPrices(pricesRes.data);
    };

    load().catch(() => setInstrument(null));
  }, [symbol]);

  useEffect(() => {
    if (!currentLivePrice) {
      return;
    }
    setPrices((prev) => [...prev.slice(-79), { symbol, price: currentLivePrice, ts: new Date().toISOString() }]);
  }, [currentLivePrice, symbol]);

  useEffect(() => {
    if (orderEvents[0]) {
      setMessage(`Ostatnie potwierdzenie: ${orderEvents[0].symbol} ${orderEvents[0].status}`);
    }
  }, [orderEvents]);

  return (
    <div className="stack">
      <div className="card">
        <h2>{instrument?.symbol || symbol}</h2>
        <p>{instrument?.name}</p>
        <p>
          Cena live: <strong>{Number(currentLivePrice ?? instrument?.lastPrice ?? 0).toFixed(4)}</strong>
        </p>
      </div>

      <Chart points={prices} symbol={symbol} />
      <OrderForm symbol={symbol} accountId={accountId} onOrderPlaced={(order) => setMessage(`Order #${order.id} ${order.status}`)} />
      {message && <p className="card">{message}</p>}
    </div>
  );
}

export default Instrument;
