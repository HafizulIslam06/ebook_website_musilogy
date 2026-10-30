import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import RichEditor from '../../components/RichEditor.jsx';
import { ErrorNote, Field, Spinner } from '../../components/ui.jsx';

// Edits an array of { key: string } rows.
function Repeater({ label, rows, columns, blank, addLabel, onChange }) {
  const set = (index, key, value) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)));

  return (
    <fieldset className="repeater">
      <legend>{label}</legend>
      {rows.map((row, index) => (
        <div className="repeater-row" key={index}>
          {columns.map((column) => (
            <input
              key={column.key}
              value={row[column.key]}
              placeholder={column.placeholder}
              aria-label={`${column.placeholder} ${index + 1}`}
              onChange={(e) => set(index, column.key, e.target.value)}
            />
          ))}
          <button
            type="button"
            className="link-button"
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
          >
            Remove
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-quiet" onClick={() => onChange([...rows, blank])}>
        {addLabel}
      </button>
    </fieldset>
  );
}

const toLines = (items) => items.join('\n');
const fromLines = (text) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

export default function ProductEditor() {
  const [product, setProduct] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api('/admin/product').then(setProduct).catch((err) => setError(err.message));
  }, []);

  const set = (key, value) => {
    setSaved('');
    setProduct((current) => ({ ...current, [key]: value }));
  };
  const bind = (key) => ({
    value: product[key] ?? '',
    onChange: (e) => set(key, e.target.value),
  });

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setFieldErrors({});
    setSaved('');
    try {
      const {
        title, short_description, details, regular_price, discount_price, tags,
        preview_text, preview_url, delivery_text, faqs, pdf_url, video_links,
      } = product;
      const next = await api('/admin/product', {
        method: 'PUT',
        body: {
          title, short_description, details: details ?? '', regular_price, discount_price,
          tags: fromLines(toLines(tags)), preview_text: preview_text ?? '',
          preview_url: preview_url ?? '', delivery_text: delivery_text ?? '', faqs,
          pdf_url: pdf_url ?? '', video_links,
        },
      });
      setProduct(next);
      setSaved('Changes saved');
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.fields ?? {});
    } finally {
      setSaving(false);
    }
  }

  async function upload(event, path, key) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setError('');
    setSaving(true);
    try {
      const result = await api(path, { method: 'POST', formData });
      set(key, result[key]);
      setSaved('File uploaded');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removePdf() {
    if (!window.confirm('Remove the uploaded PDF?')) return;
    await api('/admin/product/pdf', { method: 'DELETE' });
    set('pdf_file', null);
  }

  if (!product) return error ? <ErrorNote>{error}</ErrorNote> : <Spinner />;

  return (
    <>
      <h1>Product</h1>
      <form onSubmit={save} className="editor">
        <section className="card">
          <h2>Cover</h2>
          <div className="cover-row">
            {product.cover_url && <img src={product.cover_url} alt="Current cover" />}
            <Field label="Upload a new cover" hint="JPG, PNG or WebP, up to 5 MB">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => upload(e, '/admin/product/cover', 'cover_url')}
              />
            </Field>
          </div>
        </section>

        <section className="card">
          <h2>Listing</h2>
          <Field label="Title" error={fieldErrors.title}>
            <input {...bind('title')} />
          </Field>
          <Field label="Short description" error={fieldErrors.short_description}>
            <textarea rows="3" {...bind('short_description')} />
          </Field>
          <div className="two-up">
            <Field label="Regular price (৳)" error={fieldErrors.regular_price}>
              <input type="number" min="0" step="0.01" {...bind('regular_price')} />
            </Field>
            <Field label="Discounted price (৳)" error={fieldErrors.discount_price}>
              <input type="number" min="0" step="0.01" {...bind('discount_price')} />
            </Field>
          </div>
          <Field label="Tags / features" hint="One per line">
            <textarea
              rows="4"
              value={toLines(product.tags)}
              onChange={(e) => set('tags', e.target.value.split('\n'))}
            />
          </Field>
        </section>

        <section className="card">
          <h2>Page sections</h2>
          <p className="field-hint">
            Select text, then press a button. Leave a blank line between paragraphs.
          </p>
          <RichEditor
            label="What's inside"
            value={product.details ?? ''}
            error={fieldErrors.details}
            onChange={(value) => set('details', value)}
          />
          <RichEditor
            label="Preview"
            value={product.preview_text ?? ''}
            error={fieldErrors.preview_text}
            onChange={(value) => set('preview_text', value)}
          />
          <Field label="Free sample link" error={fieldErrors.preview_url}>
            <input type="url" {...bind('preview_url')} />
          </Field>
          <RichEditor
            label="How you get the book"
            value={product.delivery_text ?? ''}
            error={fieldErrors.delivery_text}
            onChange={(value) => set('delivery_text', value)}
          />
        </section>

        <section className="card">
          <h2>FAQ</h2>
          <Repeater
            label="FAQ"
            rows={product.faqs}
            columns={[
              { key: 'question', placeholder: 'Question' },
              { key: 'answer', placeholder: 'Answer' },
            ]}
            blank={{ question: '', answer: '' }}
            addLabel="Add question"
            onChange={(rows) => set('faqs', rows)}
          />
        </section>

        <section className="card">
          <h2>Paid content</h2>
          <p className="field-hint">Only customers with a verified payment can reach these.</p>
          <Field label="Upload PDF" hint="Stored privately, up to 200 MB. Used instead of the link below.">
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => upload(e, '/admin/product/pdf', 'pdf_file')}
            />
          </Field>
          {product.pdf_file && (
            <p className="note">
              A PDF is uploaded.{' '}
              <button type="button" className="link-button" onClick={removePdf}>
                Remove
              </button>
            </p>
          )}
          <Field label="PDF link" error={fieldErrors.pdf_url}>
            <input type="url" {...bind('pdf_url')} />
          </Field>
          <Repeater
            label="Video lessons"
            rows={product.video_links}
            columns={[
              { key: 'title', placeholder: 'Lesson title' },
              { key: 'url', placeholder: 'https://…' },
            ]}
            blank={{ title: '', url: '' }}
            addLabel="Add video"
            onChange={(rows) => set('video_links', rows)}
          />
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
