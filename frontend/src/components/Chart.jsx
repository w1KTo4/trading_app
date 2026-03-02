import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

function Chart({ points = [], symbol = 'N/A' }) {
  const data = {
    labels: points.map((p) => new Date(p.ts).toLocaleTimeString()),
    datasets: [
      {
        label: `${symbol} price`,
        data: points.map((p) => Number(p.price)),
        borderColor: '#0f766e',
        backgroundColor: 'rgba(15,118,110,0.2)',
        tension: 0.2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
  };

  return (
    <div className="card chart-card">
      <h3>Mini wykres</h3>
      <div className="chart-wrap">
        <Line data={data} options={options} />
      </div>
    </div>
  );
}

export default Chart;
