import { Link } from 'react-router-dom';
import { useWebSocketData } from '../ws/WebSocketProvider';

function InstrumentList({ instruments = [] }) {
  const { latestPrices } = useWebSocketData();

  return (
    <div className="card">
      <h3>Instrumenty</h3>
      <table className="table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Nazwa</th>
            <th>Typ</th>
            <th>Cena</th>
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
                <td>{Number(live ?? item.lastPrice).toFixed(4)}</td>
                <td>
                  <Link className="button ghost" to={`/instrument/${item.symbol}`}>
                    Szczegoly
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default InstrumentList;
