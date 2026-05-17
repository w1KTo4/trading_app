import { formatPln, formatUsd } from '../utils/formatters';

function PositionList({ positions = [], showExposure = false, showRealized = true, title = 'Pozycje' }) {
  const sortedPositions = [...positions].sort((left, right) => {
    const leftExposure = Math.abs(Number(left.quantity || 0) * Number(left.currentPrice || 0));
    const rightExposure = Math.abs(Number(right.quantity || 0) * Number(right.currentPrice || 0));
    if (rightExposure !== leftExposure) {
      return rightExposure - leftExposure;
    }
    return left.symbol.localeCompare(right.symbol);
  });
  const columnCount = 6 + Number(showExposure) + Number(showRealized);
  const grossExposure = sortedPositions.reduce(
    (acc, position) => acc + Math.abs(Number(position.quantity || 0) * Number(position.currentPrice || 0)),
    0,
  );
  const totalUnrealized = sortedPositions.reduce((acc, position) => acc + Number(position.unrealizedPnl || 0), 0);
  const totalRealized = sortedPositions.reduce((acc, position) => acc + Number(position.realizedPnl || 0), 0);

  return (
    <div className="card">
      <div className="panel-head">
        <div>
          <h3>{title}</h3>
          <p className="muted">Najwazniejsze pozycje z ekspozycja i aktualnym wynikiem.</p>
        </div>
        <span className="muted">{sortedPositions.length}</span>
      </div>

      <div className="mini-stat-grid">
        <div className="mini-stat">
          <p className="muted">Otwarte pozycje</p>
          <strong>{sortedPositions.length}</strong>
        </div>
        <div className="mini-stat">
          <p className="muted">Gross exposure</p>
          <strong>{formatPln(grossExposure, 2)}</strong>
        </div>
        <div className="mini-stat">
          <p className="muted">Open P&L</p>
          <strong className={totalUnrealized >= 0 ? 'pnl-positive' : 'pnl-negative'}>{formatPln(totalUnrealized, 2)}</strong>
        </div>
        {showRealized && (
          <div className="mini-stat">
            <p className="muted">Realized P&L</p>
            <strong className={totalRealized >= 0 ? 'pnl-positive' : 'pnl-negative'}>{formatPln(totalRealized, 2)}</strong>
          </div>
        )}
      </div>

      <div className="table-wrap">
        <table className="table positions-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Kierunek</th>
              <th>Ilosc</th>
              <th>Srednia (USD)</th>
              <th>Aktualna (USD)</th>
              {showExposure && <th>Ekspozycja (PLN)</th>}
              <th>Unrealized P&L (PLN)</th>
              {showRealized && <th>Realized P&L (PLN)</th>}
            </tr>
          </thead>
          <tbody>
            {sortedPositions.length === 0 && (
              <tr>
                <td colSpan={columnCount}>Brak otwartych pozycji</td>
              </tr>
            )}
            {sortedPositions.map((position) => (
              <tr key={position.symbol}>
                <td>
                  <strong>{position.symbol}</strong>
                </td>
                <td>
                  <span className={`position-side ${Number(position.quantity) >= 0 ? 'long' : 'short'}`}>
                    {Number(position.quantity) >= 0 ? 'LONG' : 'SHORT'}
                  </span>
                </td>
                <td>{Math.abs(Number(position.quantity)).toFixed(4)}</td>
                <td>{formatUsd(position.averagePrice, 4)}</td>
                <td>{formatUsd(position.currentPrice, 4)}</td>
                {showExposure && (
                  <td>{formatPln(Math.abs(Number(position.quantity) * Number(position.currentPrice)), 2)}</td>
                )}
                <td className={Number(position.unrealizedPnl) >= 0 ? 'pnl-positive' : 'pnl-negative'}>
                  {formatPln(position.unrealizedPnl, 2)}
                </td>
                {showRealized && (
                  <td className={Number(position.realizedPnl) >= 0 ? 'pnl-positive' : 'pnl-negative'}>
                    {formatPln(position.realizedPnl, 2)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default PositionList;

