import { requireAuth, jsonResponse } from '../../_utils.js';

// Dice al frontend se la richiesta arriva da un fotografo autenticato.
// Usato dalla galleria per mostrare i comandi riservati (es. elimina foto).
export async function onRequestGet({ request, env }) {
  const adminId = await requireAuth(request, env);
  if (!adminId) return jsonResponse({ authenticated: false }, 401);
  return jsonResponse({ authenticated: true });
}
