import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, formatDate, formatPrice } from '../../api.js';
import DeleteOrderButton from '../../components/DeleteOrderButton.jsx';
import StatusSelect from '../../components/StatusSelect.jsx';
import { ErrorNote, Spinner, StatusBadge } from '../../components/ui.jsx';
import { SITE_NAME, gmailUrl, whatsappUrl } from '../../site.js';

function Row({ label, children }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children || '—'}</dd>
    </div>
  );
}

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [accessLink, setAccessLink] = useState('');

  useEffect(() => {
    api(`/admin/orders/${id}`).then(setOrder).catch((err) => setError(err.message));
  }, [id]);

  async function newLink() {
    if (!window.confirm("This replaces the customer's current link. Continue?")) return;
    try {
      const { url } = await api(`/admin/orders/${id}/access-link`, { method: 'POST' });
      setAccessLink(url);
    } catch (err) {
      setError(err.message);
    }
  }

  if (!order) return error ? <ErrorNote>{error}</ErrorNote> : <Spinner />;

  const message = `Open your ${SITE_NAME} eBook and video lessons here:\n${accessLink}`;

  return (
    <>
      <Link to="/admin/orders" className="back">
        ← Orders
      </Link>
      <div className="title-row">
        <h1>{order.order_number}</h1>
        <StatusSelect
          order={order}
          onChange={(changes) => setOrder({ ...order, ...changes })}
          onError={setError}
        />
        <DeleteOrderButton
          order={order}
          onDeleted={() => navigate('/admin/orders', { replace: true })}
          onError={setError}
        />
      </div>
      <ErrorNote>{error}</ErrorNote>

      <div className="card">
        <h2>Customer</h2>
        <dl className="receipt">
          <Row label="Name">{order.customer_name}</Row>
          <Row label="Phone">{order.customer_phone}</Row>
          <Row label="Email">{order.customer_email}</Row>
          <Row label="Amount">{formatPrice(order.amount)}</Row>
          <Row label="Ordered">{formatDate(order.created_at)}</Row>
          <Row label="Paid">{order.paid_at && formatDate(order.paid_at)}</Row>
        </dl>
        {order.status === 'paid' && (
          <>
            <button className="btn btn-quiet" onClick={newLink}>
              New access link
            </button>
            {accessLink && (
              <>
                <p className="note">
                  Send this to the customer. It won't be shown again:
                  <code>{accessLink}</code>
                </p>
                <div className="share">
                  <a
                    className="btn btn-quiet"
                    href={whatsappUrl(message, order.customer_phone)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    WhatsApp
                  </a>
                  <a
                    className="btn btn-quiet"
                    href={gmailUrl(order.customer_email, `Your ${SITE_NAME} order`, message)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Gmail
                  </a>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <h2>Payment transactions</h2>
      {order.payments.length === 0 && (
        <p className="note">No payment has been recorded for this order yet.</p>
      )}
      {order.payments.map((payment) => (
        <div className="card" key={payment.id}>
          <dl className="receipt">
            <Row label="Status">
              <StatusBadge status={payment.status} />
            </Row>
            <Row label="Invoice ID">{payment.invoice_id}</Row>
            <Row label="Transaction ID">{payment.transaction_id}</Row>
            <Row label="Method">{payment.payment_method}</Row>
            <Row label="Sender">{payment.sender_number}</Row>
            <Row label="Amount">{payment.amount && formatPrice(payment.amount)}</Row>
            <Row label="Fee">{payment.fee && formatPrice(payment.fee)}</Row>
            <Row label="Charged">{payment.charged_amount && formatPrice(payment.charged_amount)}</Row>
            <Row label="Last verified">{formatDate(payment.verified_at)}</Row>
            {payment.note && <Row label="Note">{payment.note}</Row>}
          </dl>
        </div>
      ))}
    </>
  );
}
