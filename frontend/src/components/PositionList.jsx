function PositionList({ positions = [] }) {
  return (
    <div className="card">
      <h3>Pozycje</h3>
      <table className="table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Ilosc</th>
            <th>Srednia</th>
            <th>Aktualna</th>
            <th>Unrealized P&L</th>
            <th>Realized P&L</th>
          </tr>
        </thead>
        <tbody>
          {positions.length === 0 && (
            <tr>
              <td colSpan={6}>Brak otwartych pozycji</td>
            </tr>
          )}
          {positions.map((position) => (
            <tr key={position.symbol}>
              <td>{position.symbol}</td>
              <td>{Number(position.quantity).toFixed(4)}</td>
              <td>{Number(position.averagePrice).toFixed(4)}</td>
              <td>{Number(position.currentPrice).toFixed(4)}</td>
              <td className={Number(position.unrealizedPnl) >= 0 ? 'pnl-positive' : 'pnl-negative'}>
                {Number(position.unrealizedPnl).toFixed(2)}
              </td>
              <td className={Number(position.realizedPnl) >= 0 ? 'pnl-positive' : 'pnl-negative'}>
                {Number(position.realizedPnl).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default PositionList;
