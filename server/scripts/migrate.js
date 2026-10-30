import fs from 'node:fs/promises';
import mysql from 'mysql2/promise';
import { config } from '../src/config.js';

const DELIVERY_TEXT = [
  '1. Pay with bKash, Nagad, or Rocket on the secure checkout page.',
  '2. Your private order page opens with the PDF download and all video lessons.',
  '3. Send that link to your Gmail or WhatsApp in one tap, so you can come back to it any time.',
].join('\n');

const schema = await fs.readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
const { database, ...server } = config.db;

// Moves an existing products table from the preview_items list to formatted
// text. Runs before schema.sql, whose seed names the new columns.
async function upgradeProducts(conn) {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products'`,
  );
  const columns = rows.map((row) => row.name);
  if (!columns.includes('preview_items')) return;

  if (!columns.includes('preview_text')) {
    await conn.query(
      `ALTER TABLE products
         ADD COLUMN preview_text TEXT NULL AFTER tags,
         ADD COLUMN delivery_text TEXT NULL AFTER preview_url`,
    );
  }
  const [products] = await conn.query('SELECT id, preview_items FROM products');
  for (const { id, preview_items: items } of products) {
    const previewText = (items ?? []).map((item, index) => `${index + 1}. ${item}`).join('\n');
    await conn.query('UPDATE products SET preview_text = ?, delivery_text = ? WHERE id = ?', [
      previewText,
      DELIVERY_TEXT,
      id,
    ]);
  }
  await conn.query('ALTER TABLE products DROP COLUMN preview_items');
}

const conn = await mysql.createConnection({ ...server, multipleStatements: true, charset: 'utf8mb4' });
await conn.query(
  `CREATE DATABASE IF NOT EXISTS ${mysql.escapeId(database)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
);
await conn.query(`USE ${mysql.escapeId(database)}`);
await upgradeProducts(conn);
await conn.query(schema);
await conn.end();
console.log(`Schema applied to ${database}`);
