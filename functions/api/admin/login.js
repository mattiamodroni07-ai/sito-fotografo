import { hashPassword, generateSessionToken, jsonResponse } from '../../_utils.js';

export async function onRequestPost({ request, env }) {
  const { username, password } = await request.json();

  if (!username || !password) {
    return jsonResponse({ error: 'Dati mancanti' }, 400);
  }

  const user = await env.DB.prepare(
    'SELECT id, password_hash FROM admin_users WHERE username = ?'
  ).bind(username).first();

  if (!user) {
    return jsonResponse({ error: 'Credenziali non valide' }, 401);
  }

  const inputHash = await hashPassword(password);
  if (inputHash !== user.password_hash) {
    return jsonResponse({ error: 'Credenziali non valide' }, 401);
  }

  // Crea una nuova sessione valida 30 giorni
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await env.DB.prepare(
    'INSERT INTO sessions (token, admin_id, expires_at) VALUES (?, ?, ?)'
  ).bind(token, user.id, expiresAt).run();

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`
    }
  });
}
