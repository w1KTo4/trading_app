import { Link } from 'react-router-dom';
import { useWebSocketData } from '../ws/useWebSocketData';
import { formatPriceSource, formatUsd } from '../utils/formatters';

function InstrumentList({ instruments = [], title = 'Instrumenty', emptyMessage = 'Brak instrumentow.' }) {
  const { latestPrices } = useWebSocketData();

  return (
    <div className="card">
      <div className="panel-head">
        <div>
          <h3>{title}</h3>
          <p className="muted">Lista instrumentow z szybkim przejsciem do handlu i terminala.</p>
        </div>
        <span className="muted">{instruments.length}</span>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Nazwa</th>
              <th>Typ</th>
              <th>Cena (USD)</th>
              <th>Feed</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {instruments.map((item) => {
              const liveTick = latestPrices[item.symbol];
              const live = liveTick?.price;
              return (
                <tr key={item.symbol}>
                  <td>
                    <strong>{item.symbol}</strong>
                  </td>
                  <td>{item.name}</td>
                  <td>{item.type}</td>
                  <td>{formatUsd(live ?? item.lastPrice, 4)}</td>
                  <td>
                    <span className="pill-tag">{formatPriceSource(liveTick?.source || 'DB')}</span>
                  </td>
                  <td>
                    <div className="inline-actions">
                      <Link className="button ghost" to={`/instrument/${item.symbol}`}>
                        Handluj
                      </Link>
                      <Link className="button ghost" to="/dashboard">
                        Terminal
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
            {instruments.length === 0 && (
              <tr>
                <td colSpan={6}>{emptyMessage}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default InstrumentList;
