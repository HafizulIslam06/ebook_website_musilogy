// Renders the small formatting set offered by the admin editor. Text only ever
// becomes React children, so nothing typed here can inject markup.
const BLOCKS = [
  { prefix: '# ', Tag: 'h2' },
  { prefix: '## ', Tag: 'h3' },
  { prefix: '~ ', Tag: 'small' },
];

function inline(text) {
  return text
    .split(/\*\*(.+?)\*\*/g)
    .map((part, index) => (index % 2 ? <strong key={index}>{part}</strong> : part));
}

export default function RichText({ text }) {
  const blocks = [];

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const previous = blocks.at(-1);
    const block = BLOCKS.find(({ prefix }) => line.startsWith(prefix));
    const numbered = line.match(/^\d+\. (.*)/);

    if (!line) {
      blocks.push({ type: 'break' });
    } else if (block) {
      blocks.push({ type: 'block', Tag: block.Tag, text: line.slice(block.prefix.length) });
    } else if (numbered || line.startsWith('- ')) {
      const Tag = numbered ? 'ol' : 'ul';
      const item = numbered ? numbered[1] : line.slice(2);
      if (previous?.type === 'list' && previous.Tag === Tag) previous.items.push(item);
      else blocks.push({ type: 'list', Tag, items: [item] });
    } else if (previous?.type === 'paragraph') {
      previous.lines.push(line);
    } else {
      blocks.push({ type: 'paragraph', lines: [line] });
    }
  }

  return (
    <div className="rich">
      {blocks.map((block, index) => {
        if (block.type === 'block') {
          const { Tag } = block;
          return Tag === 'small' ? (
            <p key={index}>
              <small>{inline(block.text)}</small>
            </p>
          ) : (
            <Tag key={index}>{inline(block.text)}</Tag>
          );
        }
        if (block.type === 'list') {
          const { Tag } = block;
          return (
            <Tag key={index} className={Tag === 'ol' ? 'contents' : undefined}>
              {block.items.map((item, i) => (
                <li key={i}>
                  <span>{inline(item)}</span>
                </li>
              ))}
            </Tag>
          );
        }
        if (block.type === 'paragraph') {
          return (
            <p key={index}>
              {block.lines.map((line, i) => (
                <span key={i}>
                  {i > 0 && <br />}
                  {inline(line)}
                </span>
              ))}
            </p>
          );
        }
        return null;
      })}
    </div>
  );
}
