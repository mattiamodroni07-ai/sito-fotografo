import { requireAuth, jsonResponse, runCleanup } from '../../_utils.js';

// Trasforma "Compleanno di Giulia" in "compleanno-di-giulia-x7k2" (per usarlo nel link)
function slugify(name) {
  const base = name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // rimuove accenti
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const randomSuffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${randomSuffix}`;
}

export async function onRequestGet({ request, env }) {
  const adminId = await requireAuth(request, env);
  if (!adminId) return jsonResponse({ error: 'Non autenticato' }, 401);

  // Ogni volta che il fotografo apre la dashboard facciamo la manutenzione
  await runCleanup(env);

  const { results } = await env.DB.prepare(
    `SELECT e.*, (SELECT COUNT(*) FROM media WHERE event_id = e.id) AS media_count
     FROM events e ORDER BY e.created_at DESC`
  ).all();

  return jsonResponse(results);
}

export async function onRequestPost({ request, env }) {
  const adminId = await requireAuth(request, env);
  if (!adminId) return jsonResponse({ error: 'Non autenticato' }, 401);

  const { name, eventDate } = await request.json();
  if (!name || !eventDate) {
    return jsonResponse({ error: 'Dati mancanti' }, 400);
  }

  const id = slugify(name);
  const now = new Date();
  const eventDateObj = new Date(eventDate);

  // Upload aperti fino a 1 giorno dopo l'evento; foto/video conservati 1 settimana
  const uploadClosesAt = new Date(eventDateObj.getTime() + 1 * 24 * 60 * 60 * 1000);
  const archiveAt = new Date(eventDateObj.getTime() + 7 * 24 * 60 * 60 * 1000);

  await env.DB.prepare(
    `INSERT INTO events (id, name, event_date, created_at, upload_closes_at, archive_at, status)
     VALUES (?, ?, ?, ?, ?, ?, 'open')`
  ).bind(
    id, name, eventDate, now.toISOString(),
    uploadClosesAt.toISOString(), archiveAt.toISOString()
  ).run();

  return jsonResponse({ id, name, eventDate });
}
