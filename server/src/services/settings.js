import { pool } from '../db.js';

export const SETTINGS_ID = 1;

export async function getSettings() {
  const [[settings]] = await pool.query(
    `SELECT tagline, whatsapp, support_email, payment_methods, contact_text, privacy_policy,
            terms, refund_policy
       FROM site_settings WHERE id = ?`,
    [SETTINGS_ID],
  );
  return { ...settings, payment_methods: settings.payment_methods ?? [] };
}
