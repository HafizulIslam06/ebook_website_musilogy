import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api, formatPrice } from '../api.js';
import RichText from '../components/RichText.jsx';
import { ErrorNote, Spinner } from '../components/ui.jsx';

const TRUST = ['Secure Payment', 'Instant Digital Access', 'One-Time Payment'];
const STAR_ICON = 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2 2 9.3l6.9-1z';
const FEATURE_ICONS = [
  [/video|lesson/i, 'M8 5v14l11-7z'],
  [/ebook|pdf|book/i, 'M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z'],
  [/tab|chord/i, 'M12 3v10.55A4 4 0 1 0 14 17V7h4V3z'],
];

function Feature({ label }) {
  const path = FEATURE_ICONS.find(([pattern]) => pattern.test(label))?.[1] ?? STAR_ICON;

  return (
    <li>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d={path} />
      </svg>
      {label}
    </li>
  );
}

function Price({ product, large }) {
  const { regular_price: regular, discount_price: discount } = product;
  const percentOff = Math.round((1 - discount / regular) * 100);

  return (
    <p className={large ? 'price price-large' : 'price'}>
      <span className="price-now">{formatPrice(product.discount_price)}</span>
      {product.regular_price > product.discount_price && (
        <s className="price-was">
          <span className="sr-only">Regular price </span>
          {formatPrice(product.regular_price)}
        </s>
      )}
      {large && percentOff > 0 && <span className="price-off">{percentOff}% OFF</span>}
    </p>
  );
}

export default function Home() {
  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');
  const { hash, key } = useLocation();

  useEffect(() => {
    api('/product').then(setProduct).catch((err) => setError(err.message));
  }, []);

  // The sections only exist once the product has loaded, so a link from another
  // page can't rely on the browser's own jump to the hash.
  useEffect(() => {
    if (product && hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [product, hash, key]);

  if (error) {
    return (
      <main className="page-narrow">
        <ErrorNote>{error}</ErrorNote>
      </main>
    );
  }
  if (!product) return <Spinner />;

  return (
    <>
      <main>
        <section className="hero">
          <div className="hero-inner">
            <div className="hero-copy">
              <p className="hero-eyebrow">Music Learning eBook</p>
              <h1>{product.title}</h1>
              <p className="lede">{product.short_description}</p>
              <ul className="features">
                {product.tags.map((tag) => (
                  <Feature key={tag} label={tag} />
                ))}
              </ul>
              <Price product={product} large />
              <Link to="/checkout" className="btn btn-primary btn-hero">
                Buy Now
              </Link>
              <ul className="trust">
                {TRUST.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="hero-cover">
              {product.cover_url && <img src={product.cover_url} alt={`${product.title} cover`} />}
            </div>
          </div>
        </section>

        {product.details && (
          <section className="section" id="inside">
            <h2>What's inside</h2>
            <RichText text={product.details} />
          </section>
        )}

        {(product.preview_text || product.preview_url) && (
          <section className="section" id="preview">
            <h2>Preview</h2>
            {product.preview_text && <RichText text={product.preview_text} />}
            {product.preview_url && (
              <a
                className="btn btn-quiet"
                href={product.preview_url}
                target="_blank"
                rel="noreferrer"
              >
                View a free sample
              </a>
            )}
          </section>
        )}

        {product.delivery_text && (
          <section className="section">
            <h2>How you get the book</h2>
            <RichText text={product.delivery_text} />
          </section>
        )}

        {product.faqs.length > 0 && (
          <section className="section" id="faq">
            <h2>Questions</h2>
            <div className="faq">
              {product.faqs.map((faq) => (
                <details key={faq.question}>
                  <summary>{faq.question}</summary>
                  <p>{faq.answer}</p>
                </details>
              ))}
            </div>
          </section>
        )}
      </main>

      <div className="buy-bar">
        <Price product={product} />
        <Link to="/checkout" className="btn btn-primary">
          Buy Now
        </Link>
      </div>
    </>
  );
}
