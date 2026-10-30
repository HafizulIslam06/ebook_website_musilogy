export function Spinner({ label = 'Loading' }) {
  return (
    <div className="spinner-wrap" role="status">
      <span className="spinner" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function Field({ label, error, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

export function ErrorNote({ children }) {
  if (!children) return null;
  return (
    <p className="note note-error" role="alert">
      {children}
    </p>
  );
}

const STATUS_LABELS = {
  paid: 'Paid',
  completed: 'Paid',
  pending: 'Pending',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABELS[status] ?? status}</span>;
}
