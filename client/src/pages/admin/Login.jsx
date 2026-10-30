import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import { ErrorNote, Field } from '../../components/ui.jsx';

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api('/admin/login', { method: 'POST', body: form });
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <main className="page-narrow">
      <h1>Admin sign in</h1>
      <form onSubmit={submit}>
        <Field label="Email">
          <input
            type="email"
            autoComplete="username"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
        </Field>
        <ErrorNote>{error}</ErrorNote>
        <button className="btn btn-primary btn-block" disabled={submitting}>
          Sign in
        </button>
      </form>
    </main>
  );
}
