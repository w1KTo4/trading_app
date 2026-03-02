import { useEffect, useState } from 'react';
import InstrumentList from '../components/InstrumentList';
import api from '../services/api';

function Market() {
  const [instruments, setInstruments] = useState([]);

  useEffect(() => {
    api.get('/api/instruments').then((res) => setInstruments(res.data));
  }, []);

  return (
    <div className="stack">
      <h2>Rynek</h2>
      <InstrumentList instruments={instruments} />
    </div>
  );
}

export default Market;
