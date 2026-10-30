// Creates an admin, or resets the password of an existing one.
// Reads ADMIN_EMAIL and ADMIN_PASSWORD from the environment, or prompts.
import { createInterface } from 'node:readline/promises';
import bcrypt from 'bcryptjs';
import { pool } from '../src/db.js';

const rl = createInterface({ input: process.stdin, output: process.stdout });
const email = (process.env.ADMIN_EMAIL ?? (await rl.question('Admin email: '))).trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? (await rl.question('Password (min 12 chars): '));
rl.close();

if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 12) {
  console.error('A valid email and a password of at least 12 characters are required.');
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
await pool.query(
  `INSERT INTO admins (email, password_hash) VALUES (?, ?)
   ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
  [email, hash],
);
await pool.end();
console.log(`Admin ready: ${email}`);
