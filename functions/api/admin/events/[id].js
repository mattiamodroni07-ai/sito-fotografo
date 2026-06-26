import { requireAuth, jsonResponse } from '../../../_utils.js';

// Aggiorna uno o più campi di un evento (status, name, event_date, description). Solo fotografo.
export async function onRequestPatch({ request, params, env }) {
  const adminId = await requireAuth(request, env);
  if (!adminId) return jsonResponse({ error: 'Non autorizzato' }, 401);

  const body = await request.json();
  const sets = [];
  const vals = [];

  if (body.status !== undefined) {
    if (body.status !== 'open' && body.status !== 'closed')
      return jsonResponse({ error: 'Stato non valido' }, 400);
    sets.push('status = ?'); vals.push(body.status);
  }
  if (body.name !== undefined) {
    if (!body.name.trim()) return jsonResponse({ error: 'Nome non valido' }, 400);
    sets.push('name = ?'); vals.push(body.name.trim());
  }
  if (body.description !== undefined) {
    sets.push('description = ?'); vals.push(body.description || null);
  }
  if (body.event_date !== undefined) {
    const d = new Date(body.event_date);
    if (isNaN(d)) return jsonResponse({ error: 'Data non valida' }, 400);
    sets.push('event_date = ?', 'upload_closes_at = ?', 'archive_at = ?');
    vals.push(
      body.event_date,
      new Date(d.getTime() + 86400000).toISOString(),
      new Date(d.getTime() + 604800000).toISOString()
    );
  }

  if (sets.length === 0) return jsonResponse({ error: 'Nessun campo da aggiornare' }, 400);

  vals.push(params.id);
  const result = await env.DB.prepare(
    `UPDATE events SET ${sets.join(', ')} WHERE id = ? AND status != 'archived'`
  ).bind(...vals).run();

  if (!result.meta || result.meta.changes === 0)
    return jsonResponse({ error: 'Evento non trovato o archiviato' }, 404);

  return jsonResponse({ success: true });
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
