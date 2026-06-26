import { jsonResponse } from '../_utils.js';

function generateFileId() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost({ request, env }) {
  const formData = await request.formData();
  const file = formData.get('file');
  const eventId = formData.get('eventId');

  if (!file || !eventId) {
    return jsonResponse({ error: 'Dati mancanti' }, 400);
  }

  // Verifica che l'evento esista e sia ancora aperto agli upload
  const event = await env.DB.prepare(
    'SELECT id, status, upload_closes_at FROM events WHERE id = ?'
  ).bind(eventId).first();

  if (!event) {
    return jsonResponse({ error: 'Evento non trovato' }, 404);
  }
  // Chiuso esplicitamente oppure scaduto il termine (1 giorno dopo l'evento)
  const expired = new Date(event.upload_closes_at) < new Date();
  if (event.status !== 'open' || expired) {
    return jsonResponse({ error: 'I caricamenti per questo evento sono chiusi' }, 403);
  }

  // Limite dimensione file: 200MB (margine sotto il limite di Cloudflare)
  const MAX_SIZE = 200 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return jsonResponse({ error: 'File troppo grande (max 200MB)' }, 413);
  }

  const isVideo = file.type.startsWith('video/');
  const isImage = file.type.startsWith('image/');
  if (!isVideo && !isImage) {
    return jsonResponse({ error: 'Sono ammessi solo foto e video' }, 415);
  }

  const fileId = generateFileId();
  const extension = file.name.split('.').pop();
  const fileKey = `${eventId}/${fileId}.${extension}`;

  // Salva il file su R2
  await env.MEDIA_BUCKET.put(fileKey, file.stream(), {
    httpMetadata: { contentType: file.type }
  });

  // Registra il file nel database
  await env.DB.prepare(
    `INSERT INTO media (id, event_id, file_key, file_type, uploaded_at)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(
    fileId, eventId, fileKey, isVideo ? 'video' : 'image', new Date().toISOString()
  ).run();

  return jsonResponse({ success: true, id: fileId });
}
