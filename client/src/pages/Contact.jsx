import { useOutletContext } from 'react-router-dom';
import RichText from '../components/RichText.jsx';
import { SITE_NAME, whatsappUrl } from '../site.js';

export default function Contact() {
  const { contact_text: text, whatsapp, support_email: email } = useOutletContext();

  return (
    <main className="page-text">
      <h1>Contact Us</h1>
      {text && <RichText text={text} />}
      {(whatsapp || email) ? (
        <div className="contact-actions">
          {whatsapp && (
            <a
              className="btn btn-primary"
              href={whatsappUrl(`Hello ${SITE_NAME}`, whatsapp)}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp
            </a>
          )}
          {email && (
            <a className="btn btn-quiet" href={`mailto:${email}`}>
              {email}
            </a>
          )}
        </div>
      ) : (
        !text && <p className="note">Contact details will be added here soon.</p>
      )}
    </main>
  );
}
