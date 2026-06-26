import { requireAuth, jsonResponse } from '../../../../_utils.js';

// Elimina una singola foto/video. Riservato al fotografo autenticato.
export async function onRequestDelete({ request, params, env }) {
  const adminId = await requireAuth(request, env);
  if (!adminId) return jsonResponse({ error: 'Non autorizzato' }, 401);

  const eventId = params.id;
  const mediaId = params.mediaId;

  // Recupera il file verificando che appartenga davvero a questo evento
  const media = await env.DB.prepare(
    'SELECT file_key FROM media WHERE id = ? AND event_id = ?'
  ).bind(mediaId, eventId).first();

  if (!media) return jsonResponse({ error: 'File non trovato' }, 404);

  // Cancella prima il file da R2, poi la riga dal database
  await env.MEDIA_BUCKET.delete(media.file_key);
  await env.DB.prepare('DELETE FROM media WHERE id = ?').bind(mediaId).run();

  return jsonResponse({ success: true });
}
