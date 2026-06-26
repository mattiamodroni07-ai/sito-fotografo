import { jsonResponse } from '../../_utils.js';

export async function onRequestGet({ params, env }) {
  const eventId = params.id;

  const event = await env.DB.prepare(
    'SELECT id, name, event_date, status, zip_url, upload_closes_at FROM events WHERE id = ?'
  ).bind(eventId).first();

  if (!event) {
    return jsonResponse({ error: 'Evento non trovato' }, 404);
  }

  // Riflette in tempo reale la chiusura per scadenza, anche se il database
  // non è ancora stato aggiornato dalla manutenzione periodica.
  if (event.status === 'open' && new Date(event.upload_closes_at) < new Date()) {
    event.status = 'closed';
  }

  return jsonResponse(event);
}
