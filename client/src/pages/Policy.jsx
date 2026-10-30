import { Link, useOutletContext } from 'react-router-dom';
import RichText from '../components/RichText.jsx';

const PAGES = {
  privacy: { title: 'Privacy Policy', key: 'privacy_policy' },
  terms: { title: 'Terms & Conditions', key: 'terms' },
  refund: { title: 'Refund Policy', key: 'refund_policy' },
};

export default function Policy({ page }) {
  const settings = useOutletContext();
  const { title, key } = PAGES[page];
  const text = settings[key];

  return (
    <main className="page-text">
      <h1>{title}</h1>
      {text ? (
        <RichText text={text} />
      ) : (
        <p className="note">
          This page is being updated. If you have a question, please{' '}
          <Link to="/contact">contact us</Link>.
        </p>
      )}
    </main>
  );
}
