import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, formatDate, formatPrice } from '../api.js';
import { ErrorNote, Spinner } from '../components/ui.jsx';
import { SITE_NAME, gmailUrl, whatsappUrl } from '../site.js';

const POLL_MS = 5000;
const POLL_LIMIT = 60;

const MESSAGES = {
  pending: {
    title: 'Confirming your payment',
    body: 'This page updates by itself. You can also come back to this link later.',
  },
  cancelled: {
    title: 'Payment cancelled',
    body: "You haven't been charged. You can start again whenever you're ready.",
  },
  failed: {
    title: 'Payment failed',
    body: "We couldn't confirm this payment. Please try again.",
  },
};

function Access({ token, access }) {
  return (
    <section className="access">
      {access.has_pdf && (
        <a className="btn btn-primary btn-block" href={`/api/orders/${token}/download`}>
          Download PDF
        </a>
      )}
      {access.videos.length > 0 && (
        <>
          <h2>Video lessons</h2>
          <ol className="lessons">
            {access.videos.map((video) => (
              <li key={video.url}>
                <a href={video.url} target="_blank" rel="noreferrer">
                  {video.title}
                </a>
              </li>
            ))}
          </ol>
        </>
      )}
      {!access.has_pdf && access.videos.length === 0 && (
        <p className="note">Your content is being prepared and will appear on this page.</p>
      )}
    </section>
  );
}

function KeepLink({ order }) {
  const subject = `Your ${SITE_NAME} order: ${order.product_title}`;
  const body = `Open your eBook and video lessons here:\n${window.location.href}`;

  return (
    <section className="keep">
      <h2>Keep your link</h2>
      <p>Send this page to yourself so you can come back to it any time.</p>
      <div className="share">
        <a className="btn btn-quiet" href={whatsappUrl(body)} target="_blank" rel="noreferrer">
          WhatsApp
        </a>
        <a
          className="btn btn-quiet"
          href={gmailUrl(order.customer_email, subject, body)}
          target="_blank"
          rel="noreferrer"
        >
          Gmail
        </a>
      </div>
    </section>
  );
}

export default function Order() {
  const { token } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let timer;
    let polls = 0;

    async function load() {
      try {
        const next = await api(`/orders/${token}`);
        if (cancelled) return;
        setOrder(next);
        setError('');
        if (next.status === 'pending' && ++polls < POLL_LIMIT) timer = setTimeout(load, POLL_MS);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }

    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [token]);

  if (!order) {
    return error ? (
      <main className="page-narrow">
        <ErrorNote>{error}</ErrorNote>
        <Link to="/">Back to home</Link>
      </main>
    ) : (
      <Spinner />
    );
  }

  const message = MESSAGES[order.status];

  return (
    <main className="page-narrow">
      {order.status === 'paid' ? (
        <>
          <p className="eyebrow eyebrow-success">Payment confirmed</p>
          <h1>Thank you, {order.customer_name}</h1>
          <p>Your copy of {order.product_title} is ready.</p>
          <Access token={token} access={order.access} />
          <KeepLink order={order} />
          <p className="note">
            This is your private link to the eBook and lessons, so please don't share it with
            anyone else.
          </p>
        </>
      ) : (
        <>
          {order.status === 'pending' && <Spinner label="Checking payment" />}
          <h1>{message.title}</h1>
          <p>{message.body}</p>
          {order.status !== 'pending' && (
            <Link to="/checkout" className="btn btn-primary btn-block">
              Try Again
            </Link>
          )}
        </>
      )}

      <dl className="receipt">
        <div>
          <dt>Order ID</dt>
          <dd>{order.order_number}</dd>
        </div>
        <div>
          <dt>Date</dt>
          <dd>{formatDate(order.created_at)}</dd>
        </div>
        <div>
          <dt>Amount</dt>
          <dd>{formatPrice(order.amount)}</dd>
        </div>
      </dl>
    </main>
  );
}
