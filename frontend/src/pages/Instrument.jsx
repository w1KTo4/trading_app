import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import Chart from '../components/Chart';
import OrderForm from '../components/OrderForm';
import { useWebSocketData } from '../ws/WebSocketProvider';
import { formatUsd } from '../utils/formatters';

const INSTRUMENT_TIMEFRAME = '15m';
const INSTRUMENT_FRAME_MS = 15 * 60 * 1000;
const INSTRUMENT_CANDLE_LIMIT = 200;

const normalizeCandle = (candle) => ({
  time: candle.time,
  open: Number(candle.open),
  high: Number(candle.high),
  low: Number(candle.low),
  close: Number(candle.close),
});

const updateCandlesWithTick = (previousCandles, nextPrice) => {
  const nowMs = Date.now();
  const bucketMs = Math.floor(nowMs / INSTRUMENT_FRAME_MS) * INSTRUMENT_FRAME_MS;
  const bucketIso = new Date(bucketMs).toISOString();
  const price = Number(nextPrice);
  if (Number.isNaN(price)) {
    return previousCandles;
  }
  if (previousCandles.length === 0) {
    return [{ time: bucketIso, open: price, high: price, low: price, close: price }];
  }

  const next = [...previousCandles];
  const last = next[next.length - 1];
  const lastBucket = Math.floor(new Date(last.time).getTime() / INSTRUMENT_FRAME_MS) * INSTRUMENT_FRAME_MS;

  if (lastBucket === bucketMs) {
    next[next.length - 1] = {
      ...last,
      high: Math.max(Number(last.high), price),
      low: Math.min(Number(last.low), price),
      close: price,
    };
    return next;
  }

  next.push({ time: bucketIso, open: price, high: price, low: price, close: price });
  if (next.length > INSTRUMENT_CANDLE_LIMIT) {
    return next.slice(next.length - INSTRUMENT_CANDLE_LIMIT);
  }
  return next;
};

function Instrument({ accountId }) {
  const { symbol } = useParams();
  const { latestPrices, orderEvents } = useWebSocketData();
  const [instrument, setInstrument] = useState(null);
  const [candles, setCandles] = useState([]);
  const [message, setMessage] = useState('');

  const currentLivePrice = latestPrices[symbol]?.price;

  useEffect(() => {
    const load = async () => {
      const [instrumentRes, candlesRes] = await Promise.all([
        api.get(`/api/instruments/${symbol}`),
        api.get(`/api/instruments/${symbol}/candles?timeframe=${INSTRUMENT_TIMEFRAME}&limit=${INSTRUMENT_CANDLE_LIMIT}`),
      ]);
      setInstrument(instrumentRes.data);
      setCandles(candlesRes.data.map(normalizeCandle));
    };

    load().catch(() => setInstrument(null));
  }, [symbol]);

  useEffect(() => {
    if (currentLivePrice == null) {
      return;
    }
    setCandles((prev) => updateCandlesWithTick(prev, currentLivePrice));
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
          Cena live (USD): <strong>{formatUsd(currentLivePrice ?? instrument?.lastPrice ?? 0, 4)}</strong>
        </p>
      </div>

      <Chart candles={candles} symbol={symbol} timeframe={INSTRUMENT_TIMEFRAME} />
      <OrderForm symbol={symbol} accountId={accountId} onOrderPlaced={(order) => setMessage(`Order #${order.id} ${order.status}`)} />
      {message && <p className="card">{message}</p>}
    </div>
  );
}

export default Instrument;
