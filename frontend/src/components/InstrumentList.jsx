import { Link } from 'react-router-dom';
import { useWebSocketData } from '../ws/WebSocketProvider';
import { formatUsd } from '../utils/formatters';

function InstrumentList({ instruments = [], title = 'Instrumenty', emptyMessage = 'Brak instrumentow.' }) {
  const { latestPrices } = useWebSocketData();

  return (
    <div className="card">
      <div className="panel-head">
        <h3>{title}</h3>
        <span className="muted">{instruments.length}</span>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Nazwa</th>
            <th>Typ</th>
            <th>Cena (USD)</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {instruments.map((item) => {
            const live = latestPrices[item.symbol]?.price;
            return (
              <tr key={item.symbol}>
                <td>{item.symbol}</td>
                <td>{item.name}</td>
                <td>{item.type}</td>
                <td>{formatUsd(live ?? item.lastPrice, 4)}</td>
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
              <td colSpan={5}>{emptyMessage}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default InstrumentList;
