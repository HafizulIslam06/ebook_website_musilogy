// Needs a migrated MySQL database (server/.env). UddoktaPay is stubbed at the
// fetch boundary. Only rows with order numbers starting TEST are touched.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { pool } from '../src/db.js';
import { hashToken } from '../src/services/orders.js';
import { markCancelled, reconcilePayment } from '../src/services/payments.js';

const realFetch = globalThis.fetch;
let gateway;

function stubGateway(httpStatus, body) {
  gateway = { calls: 0, httpStatus, body };
}

async function createOrder(amount = '499.00') {
  const orderNumber = `TEST${crypto.randomBytes(6).toString('hex')}`;
  const [result] = await pool.query(
    `INSERT INTO orders (order_number, product_id, customer_name, customer_phone, customer_email,
       amount, access_token_hash)
     VALUES (?, 1, 'Test', '01712345678', 'test@example.com', ?, ?)`,
    [orderNumber, amount, hashToken(orderNumber)],
  );
  return { id: result.insertId, orderNumber };
}

async function orderStatus(id) {
  const [[row]] = await pool.query('SELECT status, paid_at FROM orders WHERE id = ?', [id]);
  return row;
}

async function paymentRows(id) {
  const [rows] = await pool.query('SELECT * FROM payments WHERE order_id = ?', [id]);
  return rows;
}

function invoice() {
  return `TESTINV${crypto.randomBytes(6).toString('hex')}`;
}

function completed(orderNumber, amount = '499.00') {
  return {
    status: 'COMPLETED',
    amount,
    fee: '0.00',
    charged_amount: amount,
    transaction_id: 'TRX123',
    payment_method: 'bkash',
    sender_number: '01700000000',
    metadata: { order_number: orderNumber },
  };
}

async function cleanup() {
  await pool.query(
    `DELETE p FROM payments p JOIN orders o ON o.id = p.order_id WHERE o.order_number LIKE 'TEST%'`,
  );
  await pool.query(`DELETE FROM orders WHERE order_number LIKE 'TEST%'`);
}

before(async () => {
  await cleanup();
  globalThis.fetch = async () => {
    gateway.calls += 1;
    return new Response(JSON.stringify(gateway.body), { status: gateway.httpStatus });
  };
});

beforeEach(() => stubGateway(200, {}));

after(async () => {
  globalThis.fetch = realFetch;
  await cleanup();
  await pool.end();
});

test('a verified payment marks the order paid and stores the transaction', async () => {
  const order = await createOrder();
  const id = invoice();
  stubGateway(200, completed(order.orderNumber));

  assert.equal(await reconcilePayment(id, order.orderNumber), 'paid');
  const { status, paid_at: paidAt } = await orderStatus(order.id);
  assert.equal(status, 'paid');
  assert.ok(paidAt);
  const [payment] = await paymentRows(order.id);
  assert.equal(payment.transaction_id, 'TRX123');
  assert.equal(payment.status, 'completed');
});

test('repeated and concurrent verification record one payment', async () => {
  const order = await createOrder();
  const id = invoice();
  stubGateway(200, completed(order.orderNumber));

  await Promise.all([1, 2, 3, 4, 5].map(() => reconcilePayment(id, order.orderNumber)));
  await reconcilePayment(id, order.orderNumber);

  assert.equal((await paymentRows(order.id)).length, 1);
  assert.equal((await orderStatus(order.id)).status, 'paid');
});

test('an underpaid invoice does not pay the order', async () => {
  const order = await createOrder();
  stubGateway(200, completed(order.orderNumber, '10.00'));

  assert.equal(await reconcilePayment(invoice(), order.orderNumber), 'failed');
  assert.equal((await orderStatus(order.id)).status, 'failed');
});

test('an invoice for a different order is rejected', async () => {
  const cheap = await createOrder();
  const victim = await createOrder();
  stubGateway(200, completed(cheap.orderNumber));

  assert.equal(await reconcilePayment(invoice(), victim.orderNumber), null);
  assert.equal((await orderStatus(victim.id)).status, 'pending');
  assert.equal((await paymentRows(victim.id)).length, 0);
});

test('a completed invoice without an order reference grants nothing', async () => {
  const order = await createOrder();
  const body = completed(order.orderNumber);
  delete body.metadata;
  stubGateway(200, body);

  assert.equal(await reconcilePayment(invoice(), order.orderNumber), null);
  assert.equal((await orderStatus(order.id)).status, 'pending');
});

test('one invoice cannot be reused by a second order', async () => {
  const first = await createOrder();
  const second = await createOrder();
  const id = invoice();
  stubGateway(200, completed(first.orderNumber));
  await reconcilePayment(id, first.orderNumber);

  stubGateway(200, { status: 'ERROR', message: 'Invalid' });
  assert.equal(await reconcilePayment(id, second.orderNumber), null);
  assert.equal((await orderStatus(second.id)).status, 'pending');
  assert.equal((await paymentRows(first.id))[0].status, 'completed');
});

test('a gateway ERROR fails the order, and a later success still pays it', async () => {
  const order = await createOrder();
  const id = invoice();
  stubGateway(400, { status: 'ERROR', message: 'Invalid Invoice ID' });
  assert.equal(await reconcilePayment(id, order.orderNumber), 'failed');

  stubGateway(200, completed(order.orderNumber));
  assert.equal(await reconcilePayment(id, order.orderNumber), 'paid');
});

test('a verified pending payment keeps the order pending', async () => {
  const order = await createOrder();
  stubGateway(200, { ...completed(order.orderNumber), status: 'PENDING' });

  assert.equal(await reconcilePayment(invoice(), order.orderNumber), 'pending');
  assert.equal((await orderStatus(order.id)).paid_at, null);
});

test('a verified payment overrides an earlier cancel, but not the reverse', async () => {
  const order = await createOrder();
  await markCancelled(order.id);
  assert.equal((await orderStatus(order.id)).status, 'cancelled');

  stubGateway(200, completed(order.orderNumber));
  await reconcilePayment(invoice(), order.orderNumber);
  await markCancelled(order.id);
  assert.equal((await orderStatus(order.id)).status, 'paid');
});

test('an outage or auth failure changes nothing', async () => {
  const order = await createOrder();
  for (const [httpStatus, body] of [
    [500, { status: 'ERROR' }],
    [401, { status: false, message: 'Invalid API key' }],
    [200, { unexpected: true }],
  ]) {
    stubGateway(httpStatus, body);
    await assert.rejects(reconcilePayment(invoice(), order.orderNumber));
  }
  assert.equal((await orderStatus(order.id)).status, 'pending');
  assert.equal((await paymentRows(order.id)).length, 0);
});
