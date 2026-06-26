const eventsList = document.getElementById('events-list');
const createModal = document.getElementById('create-modal');
const qrModal = document.getElementById('qr-modal');

const STATUS_LABELS = { open: 'Aperto', closed: 'Chiuso', archived: 'Archiviato' };

function formatDate(isoDate) {
  return new Date(isoDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}

function renderEvents(events) {
  if (events.length === 0) {
    eventsList.innerHTML = `<div class="card empty-state">Non hai ancora creato nessun evento. Inizia con il bottone qui sopra.</div>`;
    return;
  }

  eventsList.innerHTML = '';
  events.forEach(event => {
    const card = document.createElement('div');
    card.className = 'card event-card';
    card.innerHTML = `
      <div class="event-info">
        <h3>${event.name}</h3>
        <div class="event-meta">${formatDate(event.event_date)} · <span class="status-badge status-${event.status}">${STATUS_LABELS[event.status]}</span></div>
      </div>
      <div class="event-actions">
        <button class="icon-btn" title="Mostra QR" data-action="qr" data-id="${event.id}" data-name="${event.name}">▦</button>
        <a class="icon-btn" title="Galleria" href="/galleria.html?e=${event.id}" target="_blank" style="text-decoration:none">🖼</a>
        <button class="icon-btn icon-btn--danger" title="Elimina evento" data-action="delete" data-id="${event.id}">🗑</button>
      </div>
    `;
    eventsList.appendChild(card);
  });
}

async function loadEvents() {
  try {
    const res = await fetch('/api/admin/events');
    if (res.status === 401) return (window.location.href = '/admin/login.html');
    const events = await res.json();
    renderEvents(events);
  } catch (err) {
    eventsList.innerHTML = `<div class="card empty-state">Impossibile caricare gli eventi. Riprova più tardi.</div>`;
  }
}

function showQrModal(eventId, eventName) {
  const link = `${window.location.origin}/?e=${eventId}`;
  document.getElementById('qr-event-name').textContent = eventName;
  document.getElementById('qr-link').textContent = link;

  const qrCanvas = document.getElementById('qr-canvas');
  qrCanvas.innerHTML = '';
  new QRCode(qrCanvas, { text: link, width: 200, height: 200, colorDark: '#2B2118', colorLight: '#FFFFFF' });

  qrModal.classList.add('show');
}

eventsList.addEventListener('click', async (e) => {
  const qrBtn = e.target.closest('[data-action="qr"]');
  if (qrBtn) return showQrModal(qrBtn.dataset.id, qrBtn.dataset.name);

  // Click sul cestino → mostra la conferma inline "Eliminare? ✓ ✕"
  const delBtn = e.target.closest('[data-action="delete"]');
  if (delBtn) {
    const actions = delBtn.closest('.event-actions');
    actions.dataset.prev = actions.innerHTML;
    actions.innerHTML = `
      <span class="confirm-label">Eliminare?</span>
      <button class="icon-btn icon-btn--confirm" data-action="confirm-delete" data-id="${delBtn.dataset.id}" title="Conferma">✓</button>
      <button class="icon-btn" data-action="cancel-delete" title="Annulla">✕</button>`;
    return;
  }

  // Annulla → ripristina i bottoni originali
  const cancelBtn = e.target.closest('[data-action="cancel-delete"]');
  if (cancelBtn) {
    const actions = cancelBtn.closest('.event-actions');
    actions.innerHTML = actions.dataset.prev;
    return;
  }

  // Conferma → elimina davvero evento + tutte le foto
  const confirmBtn = e.target.closest('[data-action="confirm-delete"]');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = '…';
    try {
      const res = await fetch(`/api/admin/events/${confirmBtn.dataset.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      loadEvents();
    } catch {
      alert('Impossibile eliminare l\'evento. Riprova.');
      loadEvents();
    }
  }
});

document.getElementById('new-event-btn').addEventListener('click', () => createModal.classList.add('show'));
document.getElementById('cancel-create').addEventListener('click', () => createModal.classList.remove('show'));
document.getElementById('close-qr').addEventListener('click', () => {
  qrModal.classList.remove('show');
  loadEvents();
});

document.getElementById('create-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('event-name').value.trim();
  const date = document.getElementById('event-date').value;
  const submitBtn = e.target.querySelector('button[type="submit"]');

  submitBtn.disabled = true;
  submitBtn.textContent = 'Creazione…';

  try {
    const res = await fetch('/api/admin/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, eventDate: date })
    });

    if (!res.ok) throw new Error();
    const newEvent = await res.json();

    createModal.classList.remove('show');
    e.target.reset();
    showQrModal(newEvent.id, newEvent.name);
  } catch (err) {
    alert('Non è stato possibile creare l\'evento. Riprova.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Crea evento';
  }
});

document.getElementById('logout-link').addEventListener('click', async (e) => {
  e.preventDefault();
  await fetch('/api/admin/logout', { method: 'POST' });
  window.location.href = '/admin/login.html';
});

loadEvents();
