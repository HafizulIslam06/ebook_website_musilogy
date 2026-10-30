import { useRef } from 'react';
import RichText from './RichText.jsx';

const LINE_STYLES = [
  { label: 'Big heading', prefix: '# ' },
  { label: 'Heading', prefix: '## ' },
  { label: 'Small text', prefix: '~ ' },
  { label: 'List', prefix: '- ' },
  { label: 'Numbered list', prefix: '1. ' },
];
const ANY_LINE_STYLE = /^(# |## |~ |- |\d+\. )/;
const linePrefix = (prefix, index) => (prefix === '1. ' ? `${index + 1}. ` : prefix);

export default function RichEditor({ label, value, hint, error, onChange }) {
  const input = useRef(null);

  // Applies a change, then puts the selection back once React has re-rendered.
  function apply(next, start, end) {
    onChange(next);
    requestAnimationFrame(() => {
      input.current.focus();
      input.current.setSelectionRange(start, end);
    });
  }

  function bold() {
    const { selectionStart: start, selectionEnd: end } = input.current;
    const picked = value.slice(start, end) || 'bold text';
    const next = `${value.slice(0, start)}**${picked}**${value.slice(end)}`;
    apply(next, start + 2, start + 2 + picked.length);
  }

  // Sets the style on every selected line, or clears it if they already have it.
  function lineStyle(prefix) {
    const { selectionStart, selectionEnd } = input.current;
    const start = value.lastIndexOf('\n', selectionStart - 1) + 1;
    const nextBreak = value.indexOf('\n', selectionEnd);
    const end = nextBreak === -1 ? value.length : nextBreak;
    const lines = value.slice(start, end).split('\n');
    const clear = lines.every((line, index) => line.startsWith(linePrefix(prefix, index)));
    const styled = lines
      .map((line, index) => {
        const plain = line.replace(ANY_LINE_STYLE, '');
        return clear || !plain ? plain : linePrefix(prefix, index) + plain;
      })
      .join('\n');
    apply(value.slice(0, start) + styled + value.slice(end), start, start + styled.length);
  }

  return (
    <fieldset className="rich-editor">
      <legend>{label}</legend>
      {hint && <p className="field-hint">{hint}</p>}
      <div className="rich-toolbar">
        <button type="button" onClick={bold}>
          <strong>Bold</strong>
        </button>
        {LINE_STYLES.map((style) => (
          <button type="button" key={style.prefix} onClick={() => lineStyle(style.prefix)}>
            {style.label}
          </button>
        ))}
      </div>
      <div className="rich-editor-body">
        <textarea
          ref={input}
          rows="8"
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <div className="rich-preview">
          <p className="rich-preview-label">Preview</p>
          {value.trim() ? <RichText text={value} /> : <p className="field-hint">Nothing here yet.</p>}
        </div>
      </div>
      {error && <span className="field-error">{error}</span>}
    </fieldset>
  );
}
