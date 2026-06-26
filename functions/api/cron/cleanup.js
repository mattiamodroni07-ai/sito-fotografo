import { jsonResponse, runCleanup } from '../../_utils.js';

// Endpoint opzionale per un cron esterno (es. cron-job.org) che garantisce
// la pulizia anche se il fotografo non apre la dashboard.
// Va protetto impostando la variabile d'ambiente CRON_SECRET su Cloudflare
// e chiamando: /api/cron/cleanup?key=IL_TUO_SEGRETO
export async function onRequest({ request, env }) {
  if (!env.CRON_SECRET) {
    return jsonResponse({ error: 'Cron non configurato' }, 403);
  }
  const url = new URL(request.url);
  const key = url.searchParams.get('key') || request.headers.get('X-Cron-Key');
  if (key !== env.CRON_SECRET) {
    return jsonResponse({ error: 'Chiave non valida' }, 401);
  }

  const result = await runCleanup(env);
  return jsonResponse({ success: true, ...result });
}
