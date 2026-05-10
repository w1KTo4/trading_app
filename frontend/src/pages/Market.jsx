import { useEffect, useMemo, useState } from 'react';
import InstrumentList from '../components/InstrumentList';
import api from '../services/api';
import useMarketFocus from '../hooks/useMarketFocus';

function Market() {
  const [instruments, setInstruments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    api.get('/api/instruments').then((res) => setInstruments(res.data));
  }, []);

  const filteredInstruments = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    if (!search) {
      return instruments;
    }

    return instruments.filter(
      (instrument) =>
        instrument.symbol.toLowerCase().includes(search) || instrument.name.toLowerCase().includes(search),
    );
  }, [instruments, searchTerm]);
  useMarketFocus(filteredInstruments.slice(0, 6).map((instrument) => instrument.symbol));

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
