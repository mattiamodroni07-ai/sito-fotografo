import { jsonResponse } from '../../../_utils.js';

export async function onRequestGet({ params, env }) {
  const eventId = params.id;

  const { results } = await env.DB.prepare(
    'SELECT id, file_key, file_type, uploaded_at FROM media WHERE event_id = ? ORDER BY uploaded_at DESC'
  ).bind(eventId).all();

  const items = results.map(row => ({
    id: row.id,
    type: row.file_type,
    url: `/api/media/${row.file_key}`,
    uploadedAt: row.uploaded_at
  }));

  return jsonResponse(items);
}
