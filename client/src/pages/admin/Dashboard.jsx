import { useEffect, useState } from 'react';
import { api, formatPrice } from '../../api.js';
import { ErrorNote, Spinner } from '../../components/ui.jsx';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/admin/stats').then(setStats).catch((err) => setError(err.message));
  }, []);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!stats) return <Spinner />;

  const tiles = [
    ['Total Orders', stats.total_orders],
    ['Successful Sales', stats.successful_sales],
    ['Total Revenue', formatPrice(stats.revenue)],
    ['Pending Payments', stats.pending_payments],
  ];

  return (
    <>
      <h1>Dashboard</h1>
      <div className="stats">
        {tiles.map(([label, value]) => (
          <div className="stat" key={label}>
            <p className="stat-label">{label}</p>
            <p className="stat-value">{value}</p>
          </div>
        ))}
      </div>
    </>
  );
}
