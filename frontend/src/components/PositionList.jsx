import { formatUsd } from '../utils/formatters';

function PositionList({ positions = [], showExposure = false, showRealized = true, title = 'Pozycje' }) {
  const columnCount = 6 + Number(showExposure) + Number(showRealized);

  return (
    <div className="card">
      <h3>{title}</h3>
      <table className="table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Kierunek</th>
            <th>Ilosc</th>
            <th>Srednia (USD)</th>
            <th>Aktualna (USD)</th>
            {showExposure && <th>Ekspozycja (USD)</th>}
            <th>Unrealized P&L (USD)</th>
            {showRealized && <th>Realized P&L (USD)</th>}
          </tr>
        </thead>
        <tbody>
          {positions.length === 0 && (
            <tr>
              <td colSpan={columnCount}>Brak otwartych pozycji</td>
            </tr>
          )}
          {positions.map((position) => (
            <tr key={position.symbol}>
              <td>{position.symbol}</td>
              <td>
                <span className={`position-side ${Number(position.quantity) >= 0 ? 'long' : 'short'}`}>
                  {Number(position.quantity) >= 0 ? 'LONG' : 'SHORT'}
                </span>
              </td>
              <td>{Number(position.quantity).toFixed(4)}</td>
              <td>{formatUsd(position.averagePrice, 4)}</td>
              <td>{formatUsd(position.currentPrice, 4)}</td>
              {showExposure && (
                <td>{formatUsd(Math.abs(Number(position.quantity) * Number(position.currentPrice)), 2)}</td>
              )}
              <td className={Number(position.unrealizedPnl) >= 0 ? 'pnl-positive' : 'pnl-negative'}>
                {formatUsd(position.unrealizedPnl, 2)}
              </td>
              {showRealized && (
                <td className={Number(position.realizedPnl) >= 0 ? 'pnl-positive' : 'pnl-negative'}>
                  {formatUsd(position.realizedPnl, 2)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default PositionList;
