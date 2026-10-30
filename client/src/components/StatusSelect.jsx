import { useState } from 'react';
import { api } from '../api.js';

const STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function StatusSelect({ order, onChange, onError }) {
  const [saving, setSaving] = useState(false);

  async function change(event) {
    const status = event.target.value;
    const warning =
      status === 'paid'
        ? `Mark ${order.order_number} as paid? The customer gets the eBook and videos, and this counts as a sale.`
        : order.status === 'paid'
          ? `Change ${order.order_number} from paid? The customer loses access and this no longer counts as a sale.`
          : '';
    if (warning && !window.confirm(warning)) return;

    setSaving(true);
    onError('');
    try {
      onChange(await api(`/admin/orders/${order.id}/status`, { method: 'PATCH', body: { status } }));
    } catch (err) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <select
      className={`status-select badge-${order.status}`}
      value={order.status}
      disabled={saving}
      aria-label={`Status of ${order.order_number}`}
      onChange={change}
    >
      {STATUSES.map((status) => (
        <option key={status.value} value={status.value}>
          {status.label}
        </option>
      ))}
    </select>
  );
}
