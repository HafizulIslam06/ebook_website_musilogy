import crypto from 'node:crypto';
import { pool } from '../db.js';
import { AppError } from '../errors.js';

export const PRODUCT_ID = 1;

export function newAccessToken() {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}

// Only the hash is stored, so a database leak does not expose customer links.
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function newOrderNumber() {
  const date = new Date().toISOString().slice(2, 10).replaceAll('-', '');
  return `EB${date}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

export async function getProduct() {
  const [[product]] = await pool.query('SELECT * FROM products WHERE id = ?', [PRODUCT_ID]);
  if (!product) throw new AppError(404, 'Product not found');
  return product;
}

export async function findOrderByToken(token) {
  if (!/^[\w-]{43}$/.test(token)) throw new AppError(404, 'Order not found');
  const [[order]] = await pool.query('SELECT * FROM orders WHERE access_token_hash = ?', [
    hashToken(token),
  ]);
  if (!order) throw new AppError(404, 'Order not found');
  return order;
}
