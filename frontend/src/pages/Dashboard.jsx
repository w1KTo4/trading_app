import { useEffect, useState } from 'react';
import api from '../services/api';
import InstrumentList from '../components/InstrumentList';
import PositionList from '../components/PositionList';
import Chart from '../components/Chart';

function Dashboard({ accountId }) {
  const [portfolio, setPortfolio] = useState(null);
  const [instruments, setInstruments] = useState([]);
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    const load = async () => {
      const [portfolioRes, instrumentsRes] = await Promise.all([
        api.get(`/api/accounts/${accountId}/portfolio`),
        api.get('/api/instruments'),
      ]);

      setPortfolio(portfolioRes.data);
      setInstruments(instrumentsRes.data);

      if (instrumentsRes.data[0]?.symbol) {
        const pricesRes = await api.get(`/api/instruments/${instrumentsRes.data[0].symbol}/prices?limit=30`);
        setChartData(pricesRes.data);
      }
    };

    if (accountId) {
      load().catch(() => setPortfolio(null));
    }
  }, [accountId]);

  if (!accountId) {
    return <p>Brak accountId. Zaloguj sie ponownie.</p>;
  }

  return (
    <div className="stack">
      <div className="card summary-grid">
        <div>
          <p className="muted">Balance</p>
          <h2>{Number(portfolio?.balance || 0).toFixed(2)}</h2>
        </div>
        <div>
          <p className="muted">Equity</p>
          <h2>{Number(portfolio?.equity || 0).toFixed(2)}</h2>
        </div>
        <div>
          <p className="muted">Used Margin</p>
          <h2>{Number(portfolio?.usedMargin || 0).toFixed(2)}</h2>
        </div>
      </div>

      <Chart points={chartData} symbol={instruments[0]?.symbol || 'N/A'} />
      <PositionList positions={portfolio?.positions || []} />
      <InstrumentList instruments={instruments} />
    </div>
  );
}

export default Dashboard;
