import { getUserFromRequest } from '../_lib/auth.js';
import { sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return sendJson(res, 401, { error: 'Not authenticated.' });
    }

    return sendJson(res, 200, { user });
  } catch (error) {
    console.error('Session lookup error:', error);
    return sendJson(res, 500, { error: 'Could not check session.' });
  }
}
