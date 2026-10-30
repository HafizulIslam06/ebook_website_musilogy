export const SITE_NAME = 'Musilogy';

export function payWith(methods) {
  if (!methods.length) return 'Pay';
  return `Pay with ${new Intl.ListFormat('en', { type: 'disjunction' }).format(methods)}`;
}

// Bangladeshi numbers are stored as typed; wa.me needs them with the country code.
export function whatsappUrl(text, phone) {
  const number = phone?.replace(/\D/g, '').replace(/^0/, '880');
  return `https://wa.me/${number ?? ''}?text=${encodeURIComponent(text)}`;
}

export function gmailUrl(to, subject, body) {
  const params = new URLSearchParams({ view: 'cm', fs: '1', to, su: subject, body });
  return `https://mail.google.com/mail/?${params}`;
}
