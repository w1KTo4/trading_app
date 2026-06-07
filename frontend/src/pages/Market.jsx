import { useEffect, useMemo, useState } from 'react';
import InstrumentList from '../components/InstrumentList';
import api from '../services/api';
import useMarketFocus from '../hooks/useMarketFocus';

const MARKET_PREVIEW_INSTRUMENTS = [
  { symbol: 'SPX500', name: 'S&P 500 Index', type: 'INDEX' },
  { symbol: 'NAS100', name: 'NASDAQ 100 Index', type: 'INDEX' },
  { symbol: 'EURUSD', name: 'Euro / US Dollar', type: 'FOREX' },
  { symbol: 'XAUUSD', name: 'Gold Spot', type: 'METAL' },
  { symbol: 'AAPL', name: 'Apple Inc.', type: 'STOCK' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust', type: 'ETF' },
].map((instrument) => ({
  ...instrument,
  lastPrice: null,
  leverage: null,
  active: false,
  comingSoon: true,
}));

function Market() {
  const [instruments, setInstruments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    api.get('/api/instruments').then((res) => setInstruments(res.data));
  }, []);

  const visibleInstruments = useMemo(() => {
    const cryptoInstruments = instruments.filter((instrument) => instrument.type === 'CRYPTO');
    const apiSymbols = new Set(cryptoInstruments.map((instrument) => instrument.symbol));
    const previews = MARKET_PREVIEW_INSTRUMENTS.filter((instrument) => !apiSymbols.has(instrument.symbol));
    return [...cryptoInstruments, ...previews];
  }, [instruments]);

  const filteredInstruments = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    if (!search) {
      return visibleInstruments;
    }

    return visibleInstruments.filter(
      (instrument) =>
        instrument.symbol.toLowerCase().includes(search) || instrument.name.toLowerCase().includes(search),
    );
  }, [searchTerm, visibleInstruments]);
  useMarketFocus(
    filteredInstruments
      .filter((instrument) => instrument.type === 'CRYPTO' && !instrument.comingSoon)
      .slice(0, 6)
      .map((instrument) => instrument.symbol),
  );

  return (
    <div className="stack">
      <div className="card quick-actions-bar hero-card">
        <div>
          <p className="eyebrow">Market explorer</p>
          <h2>Rynek</h2>
          <p className="muted">Przegladaj instrumenty, wychwytuj ruch i przechodz od razu do handlu.</p>
        </div>
        <input
          className="market-search"
          type="text"
          placeholder="Szukaj symbolu lub nazwy..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </div>

      <InstrumentList
        instruments={filteredInstruments}
        title="Dostepne instrumenty"
        emptyMessage="Brak instrumentow dla tego wyszukiwania."
      />
    </div>
  );
}

export default Market;
