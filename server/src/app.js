import fs from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { AppError } from './errors.js';
import { adminRouter } from './routes/admin.js';
import { paymentsRouter } from './routes/payments.js';
import { publicRouter } from './routes/public.js';

export const app = express();

app.disable('x-powered-by');
app.set('trust proxy', config.trustProxy);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        'img-src': ["'self'", 'data:'],
        'upgrade-insecure-requests': config.isProduction ? [] : null,
      },
    },
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use('/uploads', express.static(config.paths.uploads, { maxAge: '7d', index: false }));

// API responses can carry customer data and access links.
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use('/api/payments', paymentsRouter);
app.use('/api/admin', adminRouter);
app.use('/api', publicRouter);
app.use('/api', () => {
  throw new AppError(404, 'Not found');
});

if (fs.existsSync(config.paths.clientDist)) {
  app.use(express.static(config.paths.clientDist));
  app.get(/^(?!\/uploads\/).*/, (_req, res) => {
    res.sendFile(path.join(config.paths.clientDist, 'index.html'));
  });
}

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.name === 'MulterError') {
    return res.status(400).json({ error: err.message });
  }
  const status = err.status ?? err.statusCode ?? 500;
  if (status >= 500 && !(err instanceof AppError)) {
    console.error(err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
  res.status(status).json({ error: err.message, fields: err.fields });
});
