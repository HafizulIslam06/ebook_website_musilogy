import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import RichEditor from '../../components/RichEditor.jsx';
import { ErrorNote, Field, Spinner } from '../../components/ui.jsx';

const PAGE_FIELDS = [
  { key: 'contact_text', label: 'Contact Us' },
  { key: 'privacy_policy', label: 'Privacy Policy' },
  { key: 'terms', label: 'Terms & Conditions' },
  { key: 'refund_policy', label: 'Refund Policy' },
];

const toLines = (items) => items.join('\n');
const fromLines = (text) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api('/admin/settings').then(setSettings).catch((err) => setError(err.message));
  }, []);

  const set = (key, value) => {
    setSaved('');
    setSettings((current) => ({ ...current, [key]: value }));
  };
  const bind = (key) => ({
    value: settings[key] ?? '',
    onChange: (e) => set(key, e.target.value),
  });

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setFieldErrors({});
    setSaved('');
    try {
      const body = Object.fromEntries(Object.entries(settings).map(([k, v]) => [k, v ?? '']));
      body.payment_methods = fromLines(toLines(settings.payment_methods));
      setSettings(await api('/admin/settings', { method: 'PUT', body }));
      setSaved('Changes saved');
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.fields ?? {});
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return error ? <ErrorNote>{error}</ErrorNote> : <Spinner />;

  return (
    <>
      <h1>Settings</h1>
      <form onSubmit={save} className="editor">
        <section className="card">
          <h2>Footer</h2>
          <Field label="Tagline" error={fieldErrors.tagline}>
            <input {...bind('tagline')} />
          </Field>
          <Field
            label="WhatsApp number"
            hint="Leave empty to hide it from the footer"
            error={fieldErrors.whatsapp}
          >
            <input type="tel" inputMode="tel" placeholder="01XXXXXXXXX" {...bind('whatsapp')} />
          </Field>
          <Field
            label="Support email"
            hint="Leave empty to hide it from the footer"
            error={fieldErrors.support_email}
          >
            <input type="email" inputMode="email" {...bind('support_email')} />
          </Field>
          <Field
            label="Payment methods"
            hint="One per line. Also shown on the home and checkout pages."
          >
            <textarea
              rows="4"
              value={toLines(settings.payment_methods)}
              onChange={(e) => set('payment_methods', e.target.value.split('\n'))}
            />
          </Field>
        </section>

        <section className="card">
          <h2>Pages</h2>
          <p className="field-hint">
            Select text, then press a button. Leave a blank line between paragraphs.
          </p>
          {PAGE_FIELDS.map(({ key, label }) => (
            <RichEditor
              key={key}
              label={label}
              value={settings[key] ?? ''}
              error={fieldErrors[key]}
              onChange={(value) => set(key, value)}
            />
          ))}
        </section>

        <div className="save-bar">
          <ErrorNote>{error}</ErrorNote>
          {saved && <p className="saved">{saved}</p>}
          <button className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </>
  );
}
