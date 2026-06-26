// Funzioni di utilità condivise da tutte le Pages Functions

// Trasforma una password in un hash sicuro (mai salvare password in chiaro)
export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Crea un token di sessione casuale e sicuro
export function generateSessionToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Legge il cookie di sessione dalla richiesta
export function getSessionToken(request) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.match(/session=([^;]+)/);
  return match ? match[1] : null;
}

// Verifica che la richiesta provenga da un fotografo autenticato
export async function requireAuth(request, env) {
  const token = getSessionToken(request);
  if (!token) return null;

  const session = await env.DB.prepare(
    'SELECT admin_id, expires_at FROM sessions WHERE token = ?'
  ).bind(token).first();

  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) return null;

  return session.admin_id;
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Manutenzione automatica degli eventi:
//  - chiude gli upload scaduti (oltre upload_closes_at)
//  - cancella foto/video degli eventi oltre archive_at e li archivia
// Viene richiamata quando il fotografo apre la dashboard e, se configurato,
// da un cron esterno tramite /api/cron/cleanup.
export async function runCleanup(env) {
  const now = new Date().toISOString();

  // 1. Eventi il cui termine di conservazione è passato: rimuovi i file
  const expired = await env.DB.prepare(
    "SELECT id FROM events WHERE status != 'archived' AND archive_at < ?"
  ).bind(now).all();

  for (const ev of expired.results) {
    const media = await env.DB.prepare(
      'SELECT file_key FROM media WHERE event_id = ?'
    ).bind(ev.id).all();

    if (media.results.length > 0) {
      await env.MEDIA_BUCKET.delete(media.results.map(m => m.file_key));
    }
    await env.DB.prepare('DELETE FROM media WHERE event_id = ?').bind(ev.id).run();
    await env.DB.prepare("UPDATE events SET status = 'archived' WHERE id = ?").bind(ev.id).run();
  }

  // 2. Eventi ancora aperti ma con upload scaduto: passano a "closed"
  await env.DB.prepare(
    "UPDATE events SET status = 'closed' WHERE status = 'open' AND upload_closes_at < ?"
  ).bind(now).run();

  return { archived: expired.results.length };
}
