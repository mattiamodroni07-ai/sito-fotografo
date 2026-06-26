import { requireAuth, jsonResponse } from '../../../_utils.js';

// Apre o chiude manualmente gli upload di un evento. Solo fotografo.
export async function onRequestPatch({ request, params, env }) {
  const adminId = await requireAuth(request, env);
  if (!adminId) return jsonResponse({ error: 'Non autorizzato' }, 401);

  const { status } = await request.json();
  if (status !== 'open' && status !== 'closed') {
    return jsonResponse({ error: 'Stato non valido' }, 400);
  }

  const result = await env.DB.prepare(
    "UPDATE events SET status = ? WHERE id = ? AND status != 'archived'"
  ).bind(status, params.id).run();

  if (!result.meta || result.meta.changes === 0) {
    return jsonResponse({ error: 'Evento non trovato o archiviato' }, 404);
  }

  return jsonResponse({ success: true, status });
}

// Elimina un intero evento e tutte le foto/video associate. Solo fotografo.
export async function onRequestDelete({ request, params, env }) {
  const adminId = await requireAuth(request, env);
  if (!adminId) return jsonResponse({ error: 'Non autorizzato' }, 401);

  const eventId = params.id;

  const event = await env.DB.prepare(
    'SELECT id FROM events WHERE id = ?'
  ).bind(eventId).first();

  if (!event) return jsonResponse({ error: 'Evento non trovato' }, 404);

  // Cancella tutti i file dell'evento da R2 (in un'unica operazione batch)
  const { results } = await env.DB.prepare(
    'SELECT file_key FROM media WHERE event_id = ?'
  ).bind(eventId).all();

  if (results.length > 0) {
    await env.MEDIA_BUCKET.delete(results.map(row => row.file_key));
  }

  // Poi ripulisce il database: prima i media, poi l'evento
  await env.DB.prepare('DELETE FROM media WHERE event_id = ?').bind(eventId).run();
  await env.DB.prepare('DELETE FROM events WHERE id = ?').bind(eventId).run();

  return jsonResponse({ success: true });
}
