import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { AppError } from '../errors.js';

const COOKIE_NAME = 'admin_session';
const SESSION_HOURS = 8;
const cookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
  secure: config.isProduction,
  path: '/api/admin',
};

export function startSession(res, adminId) {
  const token = jwt.sign({ sub: String(adminId) }, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: `${SESSION_HOURS}h`,
  });
  res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: SESSION_HOURS * 3600 * 1000 });
}

export function endSession(res) {
  res.clearCookie(COOKIE_NAME, cookieOptions);
}

export function requireAdmin(req, _res, next) {
  try {
    const payload = jwt.verify(req.cookies[COOKIE_NAME] ?? '', config.jwtSecret, {
      algorithms: ['HS256'],
    });
    req.adminId = Number(payload.sub);
    next();
  } catch {
    throw new AppError(401, 'Please sign in');
  }
}
