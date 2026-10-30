import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config.js';
import { pool, withTransaction } from '../db.js';
import { AppError } from '../errors.js';
import { endSession, requireAdmin, startSession } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { PRODUCT_ID, getProduct, newAccessToken } from '../services/orders.js';
import { SETTINGS_ID, getSettings } from '../services/settings.js';
import { coverUpload, pdfUpload, removeFile, saveCover, savePdf } from '../services/uploads.js';

export const adminRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts. Please try again later.' },
});

// Compared against when the email is unknown, so timing does not reveal which
// addresses are admins.
const DUMMY_HASH = bcrypt.hashSync(crypto.randomUUID(), 10);

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(190),
  password: z.string().min(1).max(200),
});

adminRouter.post('/login', loginLimiter, validate(loginSchema), async (req, res) => {
  const [[admin]] = await pool.query('SELECT id, password_hash FROM admins WHERE email = ?', [
    req.valid.email,
  ]);
  const matches = await bcrypt.compare(req.valid.password, admin?.password_hash ?? DUMMY_HASH);
  if (!admin || !matches) throw new AppError(401, 'Incorrect email or password');
  startSession(res, admin.id);
  res.json({ ok: true });
});

adminRouter.post('/logout', (_req, res) => {
  endSession(res);
  res.json({ ok: true });
});

adminRouter.use(requireAdmin);

adminRouter.get('/me', (req, res) => {
  res.json({ id: req.adminId });
});

adminRouter.get('/stats', async (_req, res) => {
  const [[stats]] = await pool.query(
    `SELECT COUNT(*) AS total_orders,
            COALESCE(SUM(status = 'paid'), 0) AS successful_sales,
            COALESCE(SUM(IF(status = 'paid', amount, 0)), 0) AS revenue,
            COALESCE(SUM(status = 'pending'), 0) AS pending_payments
       FROM orders`,
  );
  res.json({
    total_orders: Number(stats.total_orders),
    successful_sales: Number(stats.successful_sales),
    revenue: Number(stats.revenue),
    pending_payments: Number(stats.pending_payments),
  });
});

/* Product */

const httpUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    try {
      return ['http:', 'https:'].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, 'Enter a full http(s) link');
const optionalUrl = z.union([z.literal(''), httpUrl]).transform((value) => value || null);
const price = z.coerce.number().positive().max(99_999_999).multipleOf(0.01);

const productSchema = z
  .object({
    title: z.string().trim().min(1).max(190),
    short_description: z.string().trim().min(1).max(500),
    details: z.string().trim().max(20_000),
    regular_price: price,
    discount_price: price,
    tags: z.array(z.string().trim().min(1).max(60)).max(12),
    preview_text: z.string().trim().max(20_000),
    preview_url: optionalUrl,
    delivery_text: z.string().trim().max(20_000),
    faqs: z
      .array(
        z.object({
          question: z.string().trim().min(1).max(300),
          answer: z.string().trim().min(1).max(2000),
        }),
      )
      .max(30),
    pdf_url: optionalUrl,
    video_links: z
      .array(z.object({ title: z.string().trim().min(1).max(190), url: httpUrl }))
      .max(200),
  })
  .refine((p) => p.discount_price <= p.regular_price, {
    message: 'Discounted price cannot exceed the regular price',
    path: ['discount_price'],
  });

function adminProduct(p) {
  return {
    ...p,
    regular_price: Number(p.regular_price),
    discount_price: Number(p.discount_price),
    tags: p.tags ?? [],
    faqs: p.faqs ?? [],
    video_links: p.video_links ?? [],
  };
}

adminRouter.get('/product', async (_req, res) => {
  res.json(adminProduct(await getProduct()));
});

adminRouter.put('/product', validate(productSchema), async (req, res) => {
  const p = req.valid;
  await pool.query(
    `UPDATE products SET title = ?, short_description = ?, details = ?, regular_price = ?,
       discount_price = ?, tags = ?, preview_text = ?, preview_url = ?, delivery_text = ?,
       faqs = ?, pdf_url = ?, video_links = ?
     WHERE id = ?`,
    [
      p.title,
      p.short_description,
      p.details,
      p.regular_price,
      p.discount_price,
      JSON.stringify(p.tags),
      p.preview_text,
      p.preview_url,
      p.delivery_text,
      JSON.stringify(p.faqs),
      p.pdf_url,
      JSON.stringify(p.video_links),
      PRODUCT_ID,
    ],
  );
  res.json(adminProduct(await getProduct()));
});

adminRouter.post('/product/cover', coverUpload, async (req, res) => {
  const previous = await getProduct();
  const coverUrl = await saveCover(req.file);
  await pool.query('UPDATE products SET cover_url = ? WHERE id = ?', [coverUrl, PRODUCT_ID]);
  if (previous.cover_url?.startsWith('/uploads/')) {
    await removeFile(config.paths.uploads, previous.cover_url);
  }
  res.json({ cover_url: coverUrl });
});

adminRouter.post('/product/pdf', pdfUpload, async (req, res) => {
  const previous = await getProduct();
  const pdfFile = await savePdf(req.file);
  await pool.query('UPDATE products SET pdf_file = ? WHERE id = ?', [pdfFile, PRODUCT_ID]);
  await removeFile(config.paths.storage, previous.pdf_file);
  res.json({ pdf_file: pdfFile });
});

adminRouter.delete('/product/pdf', async (_req, res) => {
  const previous = await getProduct();
  await pool.query('UPDATE products SET pdf_file = NULL WHERE id = ?', [PRODUCT_ID]);
  await removeFile(config.paths.storage, previous.pdf_file);
  res.json({ pdf_file: null });
});

/* Site settings */

const emptyToNull = (value) => value || null;
const pageText = z.string().trim().max(20_000).transform(emptyToNull);

const settingsSchema = z.object({
  tagline: z.string().trim().min(1).max(190),
  whatsapp: z
    .union([z.literal(''), z.string().trim().regex(/^\+?\d{8,15}$/, 'Enter digits only, like 01712345678')])
    .transform(emptyToNull),
  support_email: z
    .union([z.literal(''), z.string().trim().toLowerCase().email('Enter a valid email address').max(190)])
    .transform(emptyToNull),
  payment_methods: z.array(z.string().trim().min(1).max(40)).max(10),
  contact_text: pageText,
  privacy_policy: pageText,
  terms: pageText,
  refund_policy: pageText,
});

adminRouter.get('/settings', async (_req, res) => {
  res.json(await getSettings());
});

adminRouter.put('/settings', validate(settingsSchema), async (req, res) => {
  const s = req.valid;
  await pool.query(
    `UPDATE site_settings SET tagline = ?, whatsapp = ?, support_email = ?, payment_methods = ?,
       contact_text = ?, privacy_policy = ?, terms = ?, refund_policy = ?
     WHERE id = ?`,
    [
      s.tagline,
      s.whatsapp,
      s.support_email,
      JSON.stringify(s.payment_methods),
      s.contact_text,
      s.privacy_policy,
      s.terms,
      s.refund_policy,
      SETTINGS_ID,
    ],
  );
  res.json(await getSettings());
});

/* Orders */

const ORDER_STATUSES = ['pending', 'paid', 'failed', 'cancelled'];
const orderListSchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
});
const PAGE_SIZE = 20;

adminRouter.get('/orders', validate(orderListSchema, 'query'), async (req, res) => {
  const { search, status, page } = req.valid;
  const conditions = [];
  const params = [];

  if (status) {
    conditions.push('o.status = ?');
    params.push(status);
  }
  if (search) {
    const like = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
    conditions.push(`(o.order_number LIKE ? OR o.customer_name LIKE ? OR o.customer_phone LIKE ?
      OR o.customer_email LIKE ? OR EXISTS (
        SELECT 1 FROM payments p WHERE p.order_id = o.id
          AND (p.invoice_id LIKE ? OR p.transaction_id LIKE ?)))`);
    params.push(like, like, like, like, like, like);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM orders o ${where}`, params);
  const [orders] = await pool.query(
    `SELECT o.id, o.order_number, o.customer_name, o.customer_phone, o.customer_email,
            o.amount, o.status, o.created_at
       FROM orders o ${where}
      ORDER BY o.id DESC LIMIT ? OFFSET ?`,
    [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE],
  );
  res.json({
    orders: orders.map((o) => ({ ...o, amount: Number(o.amount) })),
    page,
    page_size: PAGE_SIZE,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    total,
  });
});

const idSchema = z.object({ id: z.coerce.number().int().positive() });

adminRouter.get('/orders/:id', validate(idSchema, 'params'), async (req, res) => {
  const [[order]] = await pool.query(
    `SELECT id, order_number, customer_name, customer_phone, customer_email, amount, status,
            paid_at, created_at
       FROM orders WHERE id = ?`,
    [req.valid.id],
  );
  if (!order) throw new AppError(404, 'Order not found');
  const [payments] = await pool.query(
    `SELECT id, invoice_id, transaction_id, payment_method, sender_number, amount, fee,
            charged_amount, status, note, verified_at, created_at
       FROM payments WHERE order_id = ? ORDER BY id DESC`,
    [order.id],
  );
  res.json({ ...order, amount: Number(order.amount), payments });
});

adminRouter.delete('/orders/:id', validate(idSchema, 'params'), async (req, res) => {
  const { id } = req.valid;
  await withTransaction(async (conn) => {
    await conn.query('DELETE FROM payments WHERE order_id = ?', [id]);
    const [result] = await conn.query('DELETE FROM orders WHERE id = ?', [id]);
    if (!result.affectedRows) throw new AppError(404, 'Order not found');
  });
  res.json({ ok: true });
});

const orderStatusSchema = z.object({ status: z.enum(ORDER_STATUSES) });

// Manual override. 'paid' opens the eBook and videos to the customer's link and
// any other status closes them.
adminRouter.patch(
  '/orders/:id/status',
  validate(idSchema, 'params'),
  validate(orderStatusSchema),
  async (req, res) => {
    const { id, status } = req.valid;
    const [result] = await pool.query(
      `UPDATE orders SET status = ?, paid_at = IF(? = 'paid', COALESCE(paid_at, NOW()), NULL)
        WHERE id = ?`,
      [status, status, id],
    );
    if (!result.affectedRows) throw new AppError(404, 'Order not found');
    const [[order]] = await pool.query('SELECT status, paid_at FROM orders WHERE id = ?', [id]);
    res.json(order);
  },
);

// Customer links cannot be recovered because only their hash is stored, so a
// buyer who loses theirs is issued a new one. The old link stops working.
adminRouter.post('/orders/:id/access-link', validate(idSchema, 'params'), async (req, res) => {
  const { token, hash } = newAccessToken();
  const [result] = await pool.query(
    `UPDATE orders SET access_token_hash = ? WHERE id = ? AND status = 'paid'`,
    [hash, req.valid.id],
  );
  if (!result.affectedRows) throw new AppError(404, 'No paid order with this ID');
  res.json({ url: `${config.publicUrl}/order/${token}` });
});
