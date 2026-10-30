import { Router } from 'express';
import { findOrderByToken } from '../services/orders.js';
import { markCancelled, reconcilePayment } from '../services/payments.js';
import { WEBHOOK_KEY_HEADER, isValidWebhookKey } from '../services/uddoktapay.js';

export const paymentsRouter = Router();

const INVOICE_ID = /^[\w-]{1,64}$/;

// Customer's browser returns here after paying. invoice_id is only a lookup
// key: nothing about the query string is believed until it has been verified.
paymentsRouter.get('/return/:token', async (req, res) => {
  const order = await findOrderByToken(req.params.token);
  const invoiceId = String(req.query.invoice_id ?? '');
  if (INVOICE_ID.test(invoiceId)) {
    try {
      await reconcilePayment(invoiceId, order.order_number);
    } catch (err) {
      // The order page keeps retrying, and the webhook may still arrive.
      console.error('Verification on return failed:', err.message);
    }
  }
  res.redirect(303, `/order/${req.params.token}`);
});

paymentsRouter.get('/cancel/:token', async (req, res) => {
  const order = await findOrderByToken(req.params.token);
  await markCancelled(order.id);
  res.redirect(303, `/order/${req.params.token}`);
});

paymentsRouter.post('/webhook', async (req, res) => {
  if (!isValidWebhookKey(req.get(WEBHOOK_KEY_HEADER))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { invoice_id: invoiceId, metadata } = req.body ?? {};
  if (typeof invoiceId !== 'string' || !INVOICE_ID.test(invoiceId)) {
    return res.status(400).json({ error: 'Invalid invoice_id' });
  }
  const orderNumber = typeof metadata?.order_number === 'string' ? metadata.order_number : undefined;

  // A verify failure propagates as a 500 so the delivery can be retried.
  await reconcilePayment(invoiceId, orderNumber);
  res.json({ received: true });
});
