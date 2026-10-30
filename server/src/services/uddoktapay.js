import crypto from 'node:crypto';
import { config } from '../config.js';
import { AppError } from '../errors.js';

const { baseUrl, apiKey } = config.uddoktapay;
const API_KEY_HEADER = 'RT-UDDOKTAPAY-API-KEY';
const VERIFY_STATUSES = new Set(['COMPLETED', 'PENDING', 'ERROR']);

async function post(path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      [API_KEY_HEADER]: apiKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  try {
    return { httpStatus: res.status, data: JSON.parse(text) };
  } catch {
    return { httpStatus: res.status, data: null };
  }
}

/** Creates a hosted checkout and returns the URL to send the customer to. */
export async function createCheckout(payload) {
  const { httpStatus, data } = await post('/api/checkout-v2', payload);
  if (data?.status !== true || !/^https?:\/\//.test(data.payment_url ?? '')) {
    console.error('UddoktaPay checkout failed', httpStatus, data?.message);
    throw new AppError(502, 'Could not start the payment. Please try again.');
  }
  return data.payment_url;
}

/**
 * Asks UddoktaPay for the authoritative state of an invoice. Throws when no
 * trustworthy answer was received, so an outage or a bad API key can never be
 * mistaken for a failed payment.
 */
export async function verifyPayment(invoiceId) {
  const { httpStatus, data } = await post('/api/verify-payment', { invoice_id: invoiceId });
  const status = typeof data?.status === 'string' ? data.status.toUpperCase() : null;
  const documentedError = status === 'ERROR' && (httpStatus === 200 || httpStatus === 400);

  if (!VERIFY_STATUSES.has(status) || (httpStatus !== 200 && !documentedError)) {
    throw new Error(`Unexpected verify response: HTTP ${httpStatus}`);
  }
  return { ...data, status };
}

export function isValidWebhookKey(received) {
  const expected = crypto.createHash('sha256').update(apiKey).digest();
  const actual = crypto.createHash('sha256').update(String(received ?? '')).digest();
  return crypto.timingSafeEqual(expected, actual);
}

export const WEBHOOK_KEY_HEADER = API_KEY_HEADER;
