const STATUS_LABELS = { open: 'Aperto', closed: 'Chiuso', archived: 'Archiviato' };

let allEvents = [];
let currentEvent = null;   // evento aperto nella finestra dettaglio

// Lightbox
let lbPhotos = [];
let lbIdx = 0;
let lbTouchX = 0;

const detailModal = document.getElementById('detail-modal');
const detailScroll = document.getElementById('detail-scroll');

function formatDate(d) {
  return new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}
function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ---- Caricamento eventi ----

async function loadEvents(openId) {
  const list = document.getElementById('events-list');
  try {
    const res = await fetch('/api/admin/events');
    if (res.status === 401) return (window.location.href = '/admin/login.html');
    allEvents = await res.json();
    renderEvents();
    if (openId) {
      const ev = allEvents.find(e => e.id === openId);
      if (ev) openDetail(ev);
    }
  } catch {
    list.innerHTML = '<div class="empty-state">Impossibile caricare gli eventi. Riprova più tardi.</div>';
  }
}

function renderEvents() {
  const list = document.getElementById('events-list');
  if (!allEvents.length) {
    list.innerHTML = '<div class="empty-state">Nessun evento ancora. Creane uno con il bottone qui sopra!</div>';
    return;
  }
  list.innerHTML = '';
  allEvents.forEach(ev => {
    const count = ev.media_count || 0;
    const card = document.createElement('div');
    card.className = 'event-card';
    card.dataset.id = ev.id;
    card.innerHTML = `
      <div class="event-info">
        <h3>${escHtml(ev.name)}</h3>
        <div class="event-meta">
          ${formatDate(ev.event_date)} &middot; ${count} file &middot;
          <span class="status-badge status-${ev.status}">${STATUS_LABELS[ev.status]}</span>
        </div>
      </div>
      <div class="card-arrow">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
      </div>`;
    card.addEventListener('click', () => openDetail(ev));
    list.appendChild(card);
  });
}

// ---- Finestra dettaglio ----

function uploadSectionHtml(ev) {
  if (ev.status === 'archived')
    return `<p style="font-size:14px;color:var(--sage)">Evento archiviato — i file sono stati rimossi.</p>`;
  const isOpen = ev.status === 'open';
  return `
    <div class="toggle-row">
      <div>
        <div class="toggle-label">Stato: <strong>${isOpen ? 'Aperti' : 'Chiusi'}</strong></div>
        <div class="toggle-note">${isOpen ? 'Gli ospiti possono caricare foto e video' : 'Nuovi caricamenti disabilitati'}</div>
      </div>
      <button class="btn ${isOpen ? 'btn-ghost' : 'btn-primary'}" id="toggle-upload" style="flex-shrink:0; padding:11px 22px">
        ${isOpen ? 'Chiudi' : 'Riapri'}
      </button>
    </div>`;
}

function openDetail(ev) {
  currentEvent = ev;
  const archived = ev.status === 'archived';
  const url = `${location.origin}/?e=${ev.id}`;
  const count = ev.media_count || 0;

  document.getElementById('detail-name').textContent = ev.name;
  const badge = document.getElementById('detail-status');
  badge.className = `status-badge status-${ev.status}`;
  badge.textContent = STATUS_LABELS[ev.status];

  detailScroll.innerHTML = `
    <div class="detail-section">
      <div class="section-title">Informazioni evento</div>
      <form id="edit-form">
        <div class="field">
          <label>Nome</label>
          <input type="text" name="name" value="${escHtml(ev.name)}" required ${archived ? 'disabled' : ''}>
        </div>
        <div class="field">
          <label>Data</label>
          <input type="date" name="event_date" value="${ev.event_date}" required ${archived ? 'disabled' : ''}>
        </div>
        <div class="field">
          <label>Note private (opzionale)</label>
          <textarea name="description" rows="2" placeholder="Es. location, numero ospiti…" ${archived ? 'disabled' : ''}>${escHtml(ev.description || '')}</textarea>
        </div>
        ${!archived ? `<button type="submit" class="btn btn-primary" style="width:100%">Salva modifiche</button>
        <div class="save-feedback" id="save-fb"></div>` : ''}
      </form>
    </div>

    <div class="detail-section">
      <div class="section-title">QR Code &amp; link ospiti</div>
      <div class="qr-box" id="qr-box"></div>
      <div class="link-box">${url}</div>
      <button class="btn btn-ghost" id="download-qr" style="width:100%">Scarica QR (PNG)</button>
    </div>

    <div class="detail-section" id="upload-section">
      <div class="section-title">Caricamenti ospiti</div>
      ${uploadSectionHtml(ev)}
    </div>

    <div class="detail-section">
      <div class="section-title">Foto e video <span class="count-badge">${count}</span></div>
      <div class="photo-grid" id="photo-grid"><div class="strip-empty">Caricamento…</div></div>
    </div>

    <div class="detail-section">
      <div class="section-title danger">Zona pericolosa</div>
      <div id="delete-area">
        <button class="btn-danger" id="delete-event">Elimina evento e tutte le foto</button>
      </div>
    </div>`;

  // QR
  const qrBox = document.getElementById('qr-box');
  new QRCode(qrBox, { text: url, width: 180, height: 180, colorDark: '#2B2118', colorLight: '#FFFFFF' });

  wireDetailHandlers(ev);
  loadPhotoStrip(ev.id);

  detailScroll.scrollTop = 0;
  detailModal.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeDetail() {
  detailModal.classList.remove('show');
  detailScroll.innerHTML = '';
  currentEvent = null;
  if (!document.getElementById('lb').classList.contains('show')) document.body.style.overflow = '';
}

function wireDetailHandlers(ev) {
  // Salva modifiche
  const form = document.getElementById('edit-form');
  if (form) form.addEventListener('submit', async e => {
    e.preventDefault();
    const data = {
      name: form.elements['name'].value.trim(),
      event_date: form.elements['event_date'].value,
      description: form.elements['description'].value
    };
    const btn = form.querySelector('button[type="submit"]');
    const fb = document.getElementById('save-fb');
    btn.disabled = true; btn.textContent = 'Salvataggio…';
    try {
      const res = await fetch(`/api/admin/events/${ev.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error();
      Object.assign(ev, data);
      document.getElementById('detail-name').textContent = data.name;
      btn.textContent = '✓ Salvato!';
      if (fb) fb.textContent = '';
      renderEvents();
      setTimeout(() => { btn.textContent = 'Salva modifiche'; btn.disabled = false; }, 1800);
    } catch {
      if (fb) fb.textContent = 'Errore durante il salvataggio. Riprova.';
      btn.textContent = 'Salva modifiche'; btn.disabled = false;
    }
  });

  // Scarica QR
  const dlQr = document.getElementById('download-qr');
  if (dlQr) dlQr.addEventListener('click', () => {
    const box = document.getElementById('qr-box');
    const canvas = box.querySelector('canvas');
    const img = box.querySelector('img');
    const dataUrl = canvas ? canvas.toDataURL('image/png') : (img ? img.src : null);
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl; a.download = `qr-${ev.id}.png`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  });

  // Apri/chiudi caricamenti
  const toggleBtn = document.getElementById('toggle-upload');
  if (toggleBtn) toggleBtn.addEventListener('click', async () => {
    const next = ev.status === 'open' ? 'closed' : 'open';
    toggleBtn.disabled = true;
    try {
      const res = await fetch(`/api/admin/events/${ev.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next })
      });
      if (!res.ok) throw new Error();
      ev.status = next;
      const badge = document.getElementById('detail-status');
      badge.className = `status-badge status-${next}`;
      badge.textContent = STATUS_LABELS[next];
      const section = document.getElementById('upload-section');
      section.innerHTML = `<div class="section-title">Caricamenti ospiti</div>${uploadSectionHtml(ev)}`;
      wireDetailHandlers(ev); // riaggancia il nuovo bottone toggle
      renderEvents();
    } catch {
      alert('Impossibile aggiornare lo stato. Riprova.');
      toggleBtn.disabled = false;
    }
  });

  // Elimina evento → conferma inline
  const delBtn = document.getElementById('delete-event');
  if (delBtn) delBtn.addEventListener('click', () => {
    const area = document.getElementById('delete-area');
    area.innerHTML = `
      <div class="delete-confirm">
        <span class="delete-confirm-label">Sicuro? Azione irreversibile.</span>
        <button class="btn btn-ghost" id="cancel-del" style="padding:10px 18px">No</button>
        <button class="btn-confirm-del" id="confirm-del">Sì, elimina</button>
      </div>`;
    document.getElementById('cancel-del').addEventListener('click', () => {
      area.innerHTML = `<button class="btn-danger" id="delete-event">Elimina evento e tutte le foto</button>`;
      wireDetailHandlers(ev);
    });
    document.getElementById('confirm-del').addEventListener('click', async function () {
      this.disabled = true; this.textContent = '…';
      try {
        const res = await fetch(`/api/admin/events/${ev.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();
        allEvents = allEvents.filter(e => e.id !== ev.id);
        closeDetail();
        renderEvents();
      } catch {
        alert("Impossibile eliminare l'evento. Riprova.");
        this.disabled = false; this.textContent = 'Sì, elimina';
      }
    });
  });
}

// ---- Griglia foto (mosaico, come la galleria) ----

const ICON_DL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
const ICON_DEL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>`;

let gridItems = [];   // foto attualmente mostrate nella griglia

async function loadPhotoStrip(eventId) {
  const grid = document.getElementById('photo-grid');
  if (!grid) return;
  try {
    const res = await fetch(`/api/events/${eventId}/media`);
    const items = await res.json();
    if (!grid.isConnected) return;
    gridItems = items;
    renderGrid();
  } catch {
    if (grid.isConnected) grid.innerHTML = '<div class="strip-empty">Impossibile caricare le foto.</div>';
  }
}

function renderGrid() {
  const grid = document.getElementById('photo-grid');
  if (!grid) return;
  if (!gridItems.length) { grid.innerHTML = '<div class="strip-empty">Nessuna foto ancora.</div>'; return; }
  grid.innerHTML = '';
  gridItems.forEach((item, i) => {
    const cell = document.createElement('div');
    cell.className = 'grid-item';

    const media = document.createElement(item.type === 'video' ? 'video' : 'img');
    media.src = item.url;
    if (item.type === 'video') { media.muted = true; media.preload = 'metadata'; }
    else { media.loading = 'lazy'; media.alt = ''; }
    cell.appendChild(media);

    if (item.type === 'video') {
      const b = document.createElement('span'); b.className = 'video-badge'; b.textContent = '▶'; cell.appendChild(b);
    }

    const overlay = document.createElement('div');
    overlay.className = 'grid-overlay';

    const dl = document.createElement('button');
    dl.className = 'grid-btn'; dl.title = 'Scarica'; dl.innerHTML = ICON_DL;
    dl.addEventListener('click', e => { e.stopPropagation(); downloadItem(item, i); });
    overlay.appendChild(dl);

    const del = document.createElement('button');
    del.className = 'grid-btn grid-btn--del'; del.title = 'Elimina'; del.innerHTML = ICON_DEL;
    del.addEventListener('click', e => { e.stopPropagation(); deleteItem(item); });
    overlay.appendChild(del);

    cell.appendChild(overlay);
    cell.addEventListener('click', () => openLightbox(gridItems, i));
    grid.appendChild(cell);
  });
}

async function downloadItem(item, i) {
  const ext = (item.url.split('.').pop().split('?')[0] || '').toLowerCase();
  const name = `ricordo-${String(i + 1).padStart(3, '0')}.${ext.length <= 4 ? ext : (item.type === 'video' ? 'mp4' : 'jpg')}`;
  try {
    const res = await fetch(item.url);
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  } catch {
    window.open(item.url, '_blank');
  }
}

async function deleteItem(item) {
  if (!currentEvent) return;
  if (!confirm('Eliminare definitivamente questo file? L\'azione è irreversibile.')) return;
  try {
    const res = await fetch(`/api/events/${currentEvent.id}/media/${item.id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error();
    gridItems = gridItems.filter(x => x.id !== item.id);
    currentEvent.media_count = gridItems.length;
    const ev = allEvents.find(e => e.id === currentEvent.id);
    if (ev) ev.media_count = gridItems.length;
    renderGrid();
    const cb = detailScroll.querySelector('.count-badge');
    if (cb) cb.textContent = gridItems.length;
    renderEvents();
  } catch {
    alert('Impossibile eliminare il file. Riprova.');
  }
}

// ---- Lightbox ----

const lb = document.getElementById('lb');
const lbMediaEl = document.getElementById('lb-media');

function openLightbox(photos, idx) {
  lbPhotos = photos; lbIdx = idx;
  showLbMedia();
  lb.classList.add('show');
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  lb.classList.remove('show');
  lbMediaEl.innerHTML = '';
  if (!detailModal.classList.contains('show')) document.body.style.overflow = '';
}
function showLbMedia() {
  const item = lbPhotos[lbIdx];
  lbMediaEl.innerHTML = item.type === 'video'
    ? `<video src="${item.url}" controls autoplay playsinline></video>`
    : `<img src="${item.url}" alt="">`;
  document.getElementById('lb-count').textContent = `${lbIdx + 1} / ${lbPhotos.length}`;
  document.getElementById('lb-prev').style.visibility = lbIdx > 0 ? 'visible' : 'hidden';
  document.getElementById('lb-next').style.visibility = lbIdx < lbPhotos.length - 1 ? 'visible' : 'hidden';
}
function prevPhoto() { if (lbIdx > 0) { lbIdx--; showLbMedia(); } }
function nextPhoto() { if (lbIdx < lbPhotos.length - 1) { lbIdx++; showLbMedia(); } }

document.getElementById('lb-close').addEventListener('click', closeLightbox);
lb.addEventListener('click', e => { if (e.target === lb) closeLightbox(); });
document.getElementById('lb-prev').addEventListener('click', e => { e.stopPropagation(); prevPhoto(); });
document.getElementById('lb-next').addEventListener('click', e => { e.stopPropagation(); nextPhoto(); });
lb.addEventListener('touchstart', e => { lbTouchX = e.touches[0].clientX; }, { passive: true });
lb.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - lbTouchX;
  if (dx > 55) prevPhoto(); else if (dx < -55) nextPhoto();
});
document.addEventListener('keydown', e => {
  if (lb.classList.contains('show')) {
    if (e.key === 'ArrowLeft') prevPhoto();
    else if (e.key === 'ArrowRight') nextPhoto();
    else if (e.key === 'Escape') closeLightbox();
  } else if (detailModal.classList.contains('show') && e.key === 'Escape') {
    closeDetail();
  }
});

// ---- Chiusura finestra dettaglio ----
document.getElementById('detail-close').addEventListener('click', closeDetail);
detailModal.addEventListener('click', e => { if (e.target === detailModal) closeDetail(); });

// ---- Crea nuovo evento ----
const createModal = document.getElementById('create-modal');
document.getElementById('new-event-btn').addEventListener('click', () => createModal.classList.add('show'));
document.getElementById('cancel-create').addEventListener('click', () => createModal.classList.remove('show'));
createModal.addEventListener('click', e => { if (e.target === createModal) createModal.classList.remove('show'); });

document.getElementById('create-form').addEventListener('submit', async e => {
  e.preventDefault();
  const name = document.getElementById('new-name').value.trim();
  const date = document.getElementById('new-date').value;
  const btn = document.getElementById('create-submit');
  btn.disabled = true; btn.textContent = 'Creazione…';
  try {
    const res = await fetch('/api/admin/events', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, eventDate: date })
    });
    if (!res.ok) throw new Error();
    const newEv = await res.json();
    createModal.classList.remove('show');
    e.target.reset();
    await loadEvents(newEv.id);  // riapre subito il dettaglio col QR
  } catch {
    alert("Impossibile creare l'evento. Riprova.");
  } finally {
    btn.disabled = false; btn.textContent = 'Crea evento';
  }
});

// ---- Logout ----
document.getElementById('logout-link').addEventListener('click', async e => {
  e.preventDefault();
  await fetch('/api/admin/logout', { method: 'POST' });
  window.location.href = '/admin/login.html';
});

loadEvents();
