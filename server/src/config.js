import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(serverRoot, '.env'), quiet: true });

const SANDBOX_API_KEY = '982d381360a69d419689740d9f2e26ce36fb7a50';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const isProduction = process.env.NODE_ENV === 'production';

export const config = {
  isProduction,
  port: Number(process.env.PORT) || 4000,
  publicUrl: required('PUBLIC_URL').replace(/\/+$/, ''),
  trustProxy: Number(process.env.TRUST_PROXY) || 0,
  jwtSecret: required('JWT_SECRET'),
  db: {
    host: required('DB_HOST'),
    port: Number(process.env.DB_PORT) || 3306,
    user: required('DB_USER'),
    password: process.env.DB_PASSWORD ?? '',
    database: required('DB_NAME'),
  },
  uddoktapay: {
    baseUrl: required('UDDOKTAPAY_BASE_URL').replace(/\/+$/, ''),
    apiKey: required('UDDOKTAPAY_API_KEY'),
  },
  paths: {
    uploads: path.join(serverRoot, 'uploads'),
    storage: path.join(serverRoot, 'storage'),
    clientDist: path.join(serverRoot, '..', 'client', 'dist'),
  },
};

if (config.jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters');
}
// The sandbox key is public, so anyone could forge webhooks signed with it.
if (isProduction && config.uddoktapay.apiKey === SANDBOX_API_KEY) {
  throw new Error('Refusing to start in production with the public sandbox API key');
}
