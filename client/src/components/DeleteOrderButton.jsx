import { useState } from 'react';
import { api } from '../api.js';

export default function DeleteOrderButton({ order, onDeleted, onError }) {
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    const warning =
      order.status === 'paid'
        ? `Delete ${order.order_number}? This order is PAID. The customer loses access, the sale leaves your totals and its payment records are deleted. This cannot be undone.`
        : `Delete ${order.order_number} and its payment records? This cannot be undone.`;
    if (!window.confirm(warning)) return;

    setDeleting(true);
    onError('');
    try {
      await api(`/admin/orders/${order.id}`, { method: 'DELETE' });
      onDeleted();
    } catch (err) {
      onError(err.message);
      setDeleting(false);
    }
  }

  return (
    <button type="button" className="link-button link-danger" disabled={deleting} onClick={remove}>
      {deleting ? 'Deleting…' : 'Delete'}
    </button>
  );
}
