import { createSession, getUserFromRequest, setSessionCookie, verifyPassword } from '../_lib/auth.js';
import { ensureSchema, sql } from '../_lib/db.js';
import { readJsonBody, sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  try {
    const existingUser = await getUserFromRequest(req);
    if (existingUser) {
      return sendJson(res, 200, { user: existingUser });
    }

    await ensureSchema();
    const body = await readJsonBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!email || !password) {
      return sendJson(res, 400, { error: 'Email and password are required.' });
    }

    const rows = await sql`
      select id, email, password_hash, password_salt, role, is_unlimited
      from users
      where email = ${email}
      limit 1
    `;

    const user = rows[0];
    if (!user || !verifyPassword(password, user)) {
      return sendJson(res, 401, { error: 'Invalid email or password.' });
    }

    const session = await createSession(user.id);
    setSessionCookie(res, session.rawToken, session.expiresAt);

    return sendJson(res, 200, {
      user: {
        id: Number(user.id),
        email: user.email,
        role: user.role,
        isUnlimited: user.is_unlimited,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return sendJson(res, 500, { error: 'Could not log in right now.' });
  }
}
