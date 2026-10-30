import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config.js';
import { pool } from '../db.js';
import { AppError } from '../errors.js';
import { validate } from '../middleware/validate.js';
import {
  PRODUCT_ID,
  findOrderByToken,
  getProduct,
  newAccessToken,
  newOrderNumber,
} from '../services/orders.js';
import { refreshOrderPayment } from '../services/payments.js';
import { getSettings } from '../services/settings.js';
import { createCheckout } from '../services/uddoktapay.js';

export const publicRouter = Router();

const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in a few minutes.' },
});

const orderSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(120),
  phone: z
    .string()
    .trim()
    .regex(/^(\+?88)?01[3-9]\d{8}$/, 'Enter a valid Bangladeshi mobile number'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(190),
});

// Paid-only fields (pdf_url, pdf_file, video_links) are deliberately left out.
publicRouter.get('/product', async (_req, res) => {
  const p = await getProduct();
  res.json({
    title: p.title,
    short_description: p.short_description,
    details: p.details,
    cover_url: p.cover_url,
    regular_price: Number(p.regular_price),
    discount_price: Number(p.discount_price),
    tags: p.tags ?? [],
    preview_text: p.preview_text,
    preview_url: p.preview_url,
    delivery_text: p.delivery_text,
    faqs: p.faqs ?? [],
  });
});

publicRouter.get('/settings', async (_req, res) => {
  res.json(await getSettings());
});

publicRouter.post('/orders', orderLimiter, validate(orderSchema), async (req, res) => {
  const { name, phone, email } = req.valid;
  const product = await getProduct();
  const orderNumber = newOrderNumber();
  const { token, hash } = newAccessToken();

  // The amount always comes from the database, never from the client.
  const [result] = await pool.query(
    `INSERT INTO orders
       (order_number, product_id, customer_name, customer_phone, customer_email, amount, access_token_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [orderNumber, PRODUCT_ID, name, phone, email, product.discount_price, hash],
  );

  try {
    // The token is in the path because UddoktaPay appends invoice_id to redirect_url.
    const paymentUrl = await createCheckout({
      full_name: name,
      email,
      amount: String(product.discount_price),
      metadata: { order_number: orderNumber, phone },
      redirect_url: `${config.publicUrl}/api/payments/return/${token}`,
      cancel_url: `${config.publicUrl}/api/payments/cancel/${token}`,
      webhook_url: `${config.publicUrl}/api/payments/webhook`,
      return_type: 'GET',
    });
    res.status(201).json({ payment_url: paymentUrl });
  } catch (err) {
    await pool.query(`UPDATE orders SET status = 'failed' WHERE id = ?`, [result.insertId]);
    throw err;
  }
});

publicRouter.get('/orders/:token', async (req, res) => {
  const order = await findOrderByToken(req.params.token);
  const status = order.status === 'paid' ? 'paid' : await refreshOrderPayment(order);
  const product = await getProduct();

  res.json({
    order_number: order.order_number,
    status,
    amount: Number(order.amount),
    customer_name: order.customer_name,
    customer_email: order.customer_email,
    created_at: order.created_at,
    product_title: product.title,
    access:
      status === 'paid'
        ? {
            has_pdf: Boolean(product.pdf_file || product.pdf_url),
            videos: product.video_links ?? [],
          }
        : null,
  });
});

publicRouter.get('/orders/:token/download', async (req, res) => {
  const order = await findOrderByToken(req.params.token);
  if (order.status !== 'paid') throw new AppError(403, 'This order has not been paid');

  const product = await getProduct();
  const filename = `${product.title.replace(/[^\w-]+/g, '-').toLowerCase() || 'ebook'}.pdf`;

  if (product.pdf_file) {
    const filePath = path.join(config.paths.storage, path.basename(product.pdf_file));
    if (!fs.existsSync(filePath)) throw new AppError(404, 'The file is not available yet');
    return res.download(filePath, filename);
  }
  if (!product.pdf_url) throw new AppError(404, 'The file is not available yet');

  // Streamed through this server so the source link is not revealed to buyers.
  const upstream = await fetch(product.pdf_url);
  if (!upstream.ok || !upstream.body) throw new AppError(502, 'The file could not be fetched');
  res.attachment(filename).type('application/pdf');
  await pipeline(Readable.fromWeb(upstream.body), res);
});
