import { pool, withTransaction } from '../db.js';
import { verifyPayment } from './uddoktapay.js';

function toMinorUnits(value) {
  return Math.round(Number(value) * 100);
}

function decimalOrNull(value) {
  const number = Number(value);
  return value === undefined || value === null || Number.isNaN(number) ? null : number;
}

function parseMetadata(metadata) {
  if (typeof metadata !== 'string') return metadata ?? {};
  try {
    return JSON.parse(metadata) ?? {};
  } catch {
    return {};
  }
}

// Decides what a verified gateway answer means for this order.
function evaluate(verified, order) {
  if (verified.status === 'PENDING') return { payment: 'pending' };
  if (verified.status === 'ERROR') return { payment: 'failed', note: verified.message };
  if (toMinorUnits(verified.amount) < toMinorUnits(order.amount)) {
    return { payment: 'failed', note: 'Amount paid is less than the order amount' };
  }
  return { payment: 'completed' };
}

// `paid` is terminal. A cancelled or failed order can still become paid or
// pending, because a verified result outranks an earlier redirect.
function nextOrderStatus(current, payment) {
  if (current === 'paid') return 'paid';
  if (payment === 'completed') return 'paid';
  if (payment === 'pending') return 'pending';
  return current === 'pending' ? 'failed' : current;
}

/**
 * The single path by which a payment can change an order. Every caller (the
 * customer redirect, the webhook and order page refreshes) supplies only an
 * invoice ID. The outcome always comes from UddoktaPay's verify API, and
 * repeat or concurrent calls are safe because the order row is locked and
 * invoice_id is unique.
 *
 * expectedOrderNumber is the order the caller already knows about, if any.
 * Returns the updated order status, or null when the invoice was rejected.
 */
export async function reconcilePayment(invoiceId, expectedOrderNumber) {
  const verified = await verifyPayment(invoiceId);
  const metadataOrder = parseMetadata(verified.metadata).order_number;
  const verifiedOrder = metadataOrder === undefined ? undefined : String(metadataOrder);

  if (verifiedOrder && expectedOrderNumber && verifiedOrder !== expectedOrderNumber) {
    console.warn(`Invoice ${invoiceId} belongs to ${verifiedOrder}, not ${expectedOrderNumber}`);
    return null;
  }
  // A successful payment must name its order. Only an ERROR, which has no
  // metadata and grants nothing, may rely on the caller's order.
  const orderNumber = verifiedOrder ?? (verified.status === 'ERROR' ? expectedOrderNumber : null);
  if (!orderNumber) {
    console.warn(`Invoice ${invoiceId} could not be matched to an order`);
    return null;
  }

  return withTransaction(async (conn) => {
    const [[order]] = await conn.query(
      'SELECT id, amount, status FROM orders WHERE order_number = ? FOR UPDATE',
      [orderNumber],
    );
    if (!order) {
      console.warn(`Invoice ${invoiceId} names unknown order ${orderNumber}`);
      return null;
    }

    const [[existing]] = await conn.query(
      'SELECT order_id, status FROM payments WHERE invoice_id = ? FOR UPDATE',
      [invoiceId],
    );
    if (existing && existing.order_id !== order.id) {
      console.warn(`Invoice ${invoiceId} is already attached to another order`);
      return null;
    }
    if (existing?.status === 'completed') return order.status;

    const outcome = evaluate(verified, order);
    await conn.query(
      `INSERT INTO payments
         (order_id, invoice_id, transaction_id, payment_method, sender_number,
          amount, fee, charged_amount, status, note, gateway_response, verified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         transaction_id = VALUES(transaction_id), payment_method = VALUES(payment_method),
         sender_number = VALUES(sender_number), amount = VALUES(amount), fee = VALUES(fee),
         charged_amount = VALUES(charged_amount), status = VALUES(status), note = VALUES(note),
         gateway_response = VALUES(gateway_response), verified_at = NOW()`,
      [
        order.id,
        invoiceId,
        verified.transaction_id ?? null,
        verified.payment_method ?? null,
        verified.sender_number ?? null,
        decimalOrNull(verified.amount),
        decimalOrNull(verified.fee),
        decimalOrNull(verified.charged_amount),
        outcome.payment,
        outcome.note?.slice(0, 190) ?? null,
        JSON.stringify(verified),
      ],
    );

    const status = nextOrderStatus(order.status, outcome.payment);
    if (status !== order.status) {
      await conn.query(
        `UPDATE orders SET status = ?, paid_at = IF(? = 'paid', NOW(), paid_at) WHERE id = ?`,
        [status, status, order.id],
      );
    }
    return status;
  });
}

// A cancel redirect proves nothing about money, so it only moves a pending
// order. A later verified payment still wins.
export async function markCancelled(orderId) {
  await pool.query(`UPDATE orders SET status = 'cancelled' WHERE id = ? AND status = 'pending'`, [
    orderId,
  ]);
}

// Re-checks the latest invoice of an unpaid order, at most once per interval.
export async function refreshOrderPayment(order, minSeconds = 15) {
  const [[payment]] = await pool.query(
    `SELECT invoice_id, TIMESTAMPDIFF(SECOND, verified_at, NOW()) AS age
       FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1`,
    [order.id],
  );
  if (!payment || payment.age < minSeconds) return order.status;
  try {
    return (await reconcilePayment(payment.invoice_id, order.order_number)) ?? order.status;
  } catch (err) {
    console.error('Payment refresh failed:', err.message);
    return order.status;
  }
}
