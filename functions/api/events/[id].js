import { jsonResponse } from '../../_utils.js';

export async function onRequestGet({ params, env }) {
  const eventId = params.id;

  const event = await env.DB.prepare(
    'SELECT id, name, event_date, status, zip_url FROM events WHERE id = ?'
  ).bind(eventId).first();

  if (!event) {
    return jsonResponse({ error: 'Evento non trovato' }, 404);
  }

  return jsonResponse(event);
}
