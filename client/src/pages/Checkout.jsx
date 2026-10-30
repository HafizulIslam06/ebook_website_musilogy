import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { api, formatPrice } from '../api.js';
import { ErrorNote, Field, Spinner } from '../components/ui.jsx';
import { payWith } from '../site.js';

export default function Checkout() {
  const [product, setProduct] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { payment_methods: methods } = useOutletContext();

  useEffect(() => {
    api('/product').then(setProduct).catch((err) => setError(err.message));
  }, []);

  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setFieldErrors({});
    try {
      const { payment_url: paymentUrl } = await api('/orders', { method: 'POST', body: form });
      window.location.assign(paymentUrl);
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.fields ?? {});
      setSubmitting(false);
    }
  }

  if (!product && !error) return <Spinner />;

  return (
    <main className="page-narrow">
      <Link to="/" className="back">
        ← Back
      </Link>
      <h1>Checkout</h1>

      {product && (
        <div className="summary">
          {product.cover_url && <img src={product.cover_url} alt="" />}
          <div>
            <p className="summary-title">{product.title}</p>
            <p className="summary-price">{formatPrice(product.discount_price)}</p>
          </div>
        </div>
      )}

      <form onSubmit={submit} noValidate>
        <Field label="Full name" error={fieldErrors.name}>
          <input value={form.name} onChange={update('name')} autoComplete="name" required />
        </Field>
        <Field label="Mobile number" error={fieldErrors.phone}>
          <input
            value={form.phone}
            onChange={update('phone')}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="01XXXXXXXXX"
            required
          />
        </Field>
        <Field label="Email" error={fieldErrors.email}>
          <input
            value={form.email}
            onChange={update('email')}
            type="email"
            inputMode="email"
            autoComplete="email"
            required
          />
        </Field>

        <ErrorNote>{Object.keys(fieldErrors).length ? '' : error}</ErrorNote>

        <button className="btn btn-primary btn-block" disabled={submitting || !product}>
          {submitting ? 'Redirecting…' : 'Continue to Payment'}
        </button>
        <p className="fine-print">{payWith(methods)} on UddoktaPay's secure page.</p>
      </form>
    </main>
  );
}
