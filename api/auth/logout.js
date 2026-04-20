import { clearSessionCookie, deleteSession } from '../_lib/auth.js';
import { sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  try {
    await deleteSession(req);
    clearSessionCookie(res);
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    console.error('Logout error:', error);
    clearSessionCookie(res);
    return sendJson(res, 200, { ok: true });
  }
}
