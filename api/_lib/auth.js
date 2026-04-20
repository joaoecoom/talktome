import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import { ensureSchema, sql } from './db.js';

const SESSION_COOKIE = 'ttm_session';
const SESSION_TTL_DAYS = 30;

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createPasswordRecord(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);

  return { salt, passwordHash };
}

export function verifyPassword(password, user) {
  const candidateHash = hashPassword(password, user.password_salt);
  const left = Buffer.from(candidateHash, 'hex');
  const right = Buffer.from(user.password_hash, 'hex');

  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

export function setSessionCookie(res, token, expiresAt) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Secure; Expires=${expiresAt.toUTCString()}`
  );
}

export function clearSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Secure; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
  );
}

export function getSessionToken(req) {
  const cookieHeader = req.headers.cookie || '';
  const cookies = cookieHeader.split(';');

  for (const rawCookie of cookies) {
    const cookie = rawCookie.trim();
    if (cookie.startsWith(`${SESSION_COOKIE}=`)) {
      return decodeURIComponent(cookie.slice(SESSION_COOKIE.length + 1));
    }
  }

  return null;
}

export async function createSession(userId) {
  await ensureSchema();

  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await sql`
    insert into sessions (user_id, token_hash, expires_at)
    values (${userId}, ${tokenHash}, ${expiresAt.toISOString()})
  `;

  return { rawToken, expiresAt };
}

export async function getUserFromRequest(req) {
  await ensureSchema();

  const token = getSessionToken(req);
  if (!token) {
    return null;
  }

  const tokenHash = hashToken(token);
  const rows = await sql`
    select
      users.id,
      users.email,
      users.role,
      users.is_unlimited,
      sessions.id as session_id,
      sessions.expires_at
    from sessions
    join users on users.id = sessions.user_id
    where sessions.token_hash = ${tokenHash}
    limit 1
  `;

  const session = rows[0];
  if (!session) {
    return null;
  }

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await sql`delete from sessions where id = ${session.session_id}`;
    return null;
  }

  return {
    id: Number(session.id),
    email: session.email,
    role: session.role,
    isUnlimited: session.is_unlimited,
  };
}

export async function deleteSession(req) {
  const token = getSessionToken(req);
  if (!token) {
    return;
  }

  await ensureSchema();
  await sql`delete from sessions where token_hash = ${hashToken(token)}`;
}
