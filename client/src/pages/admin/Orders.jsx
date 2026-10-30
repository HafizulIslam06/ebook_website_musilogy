import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, formatDate, formatPrice } from '../../api.js';
import DeleteOrderButton from '../../components/DeleteOrderButton.jsx';
import StatusSelect from '../../components/StatusSelect.jsx';
import { ErrorNote, Spinner } from '../../components/ui.jsx';

export default function Orders() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('search') ?? '');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [reloads, setReloads] = useState(0);
  const query = params.toString();

  useEffect(() => {
    let current = true;
    api(`/admin/orders?${query}`)
      .then((next) => current && setData(next))
      .catch((err) => current && setError(err.message));
    return () => {
      current = false;
    };
  }, [query, reloads]);

  // Deleting the only order on the last page would otherwise leave an empty page.
  function afterDelete() {
    if (data.orders.length === 1 && data.page > 1) setFilter({ page: String(data.page - 1) });
    else setReloads(reloads + 1);
  }

  function updateOrder(id, changes) {
    setData((current) => ({
      ...current,
      orders: current.orders.map((order) => (order.id === id ? { ...order, ...changes } : order)),
    }));
  }

  function setFilter(changes) {
    const next = new URLSearchParams(params);
    next.delete('page');
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next);
  }

  return (
    <>
      <h1>Orders</h1>
      <form
        className="filters"
        onSubmit={(event) => {
          event.preventDefault();
          setFilter({ search: search.trim() });
        }}
      >
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, phone, email or ID"
          aria-label="Search orders"
        />
        <select
          value={params.get('status') ?? ''}
          onChange={(e) => setFilter({ status: e.target.value })}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button className="btn btn-quiet">Search</button>
      </form>

      <ErrorNote>{error}</ErrorNote>
      {!data && !error && <Spinner />}
      {data?.orders.length === 0 && <p className="note">No orders found.</p>}

      {data?.orders.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>No</th>
                <th>Order</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.orders.map((order, index) => (
                <tr key={order.id}>
                  <td data-label="No">{data.total - (data.page - 1) * data.page_size - index}</td>
                  <td data-label="Order">
                    <Link to={`/admin/orders/${order.id}`}>{order.order_number}</Link>
                  </td>
                  <td data-label="Customer">
                    {order.customer_name}
                    <small>{order.customer_phone}</small>
                    <small>{order.customer_email}</small>
                  </td>
                  <td data-label="Amount">{formatPrice(order.amount)}</td>
                  <td data-label="Status">
                    <StatusSelect
                      order={order}
                      onChange={(changes) => updateOrder(order.id, changes)}
                      onError={setError}
                    />
                  </td>
                  <td data-label="Date">{formatDate(order.created_at)}</td>
                  <td data-label="Actions">
                    <DeleteOrderButton order={order} onDeleted={afterDelete} onError={setError} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data?.pages > 1 && (
        <div className="pager">
          <button
            className="btn btn-quiet"
            disabled={data.page <= 1}
            onClick={() => setFilter({ page: String(data.page - 1) })}
          >
            Previous
          </button>
          <span>
            Page {data.page} of {data.pages}
          </span>
          <button
            className="btn btn-quiet"
            disabled={data.page >= data.pages}
            onClick={() => setFilter({ page: String(data.page + 1) })}
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}
