const STATUS_LABELS = { open: 'Aperto', closed: 'Chiuso', archived: 'Archiviato' };

let allEvents = [];
let openCardId = null;
const qrGenerated = new Set();
const photosLoaded = new Set();

// Lightbox
let lbPhotos = [];
let lbIdx = 0;
let lbTouchX = 0;

function formatDate(d) {
  return new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ---- Data loading ----

async function loadEvents(keepOpenId) {
  const list = document.getElementById('events-list');
  try {
    const res = await fetch('/api/admin/events');
    if (res.status === 401) return (window.location.href = '/admin/login.html');
    allEvents = await res.json();
    const restoreId = keepOpenId ?? null;
    openCardId = null;
    qrGenerated.clear();
    photosLoaded.clear();
    renderEvents();
    if (restoreId) {
      const card = document.getElementById(`card-${restoreId}`);
      if (card) openCard(card, restoreId);
    }
  } catch {
    list.innerHTML = '<div class="empty-state">Impossibile caricare gli eventi. Riprova più tardi.</div>';
  }
}

// ---- Rendering ----

function renderEvents() {
  const list = document.getElementById('events-list');
  if (!allEvents.length) {
    list.innerHTML = '<div class="empty-state">Nessun evento ancora. Creane uno con il bottone qui sopra!</div>';
    return;
  }
  list.innerHTML = '';
  allEvents.forEach(ev => list.appendChild(buildCard(ev)));
}

function renderUploadSection(ev) {
  if (ev.status === 'archived') {
    return `<p style="font-size:14px;color:var(--sage)">Evento archiviato — i file sono stati rimossi.</p>`;
  }
  const isOpen = ev.status === 'open';
  return `
    <div class="toggle-row">
      <div>
        <div class="toggle-label">Stato: <strong>${isOpen ? 'Aperti' : 'Chiusi'}</strong></div>
        <div class="toggle-note">${isOpen ? 'Gli ospiti possono caricare foto e video' : 'Nuovi caricamenti disabilitati'}</div>
      </div>
      <button class="btn ${isOpen ? 'btn-ghost' : 'btn-primary'}" style="flex-shrink:0; padding:11px 22px"
        data-action="toggle-upload" data-id="${ev.id}" data-status="${ev.status}">
        ${isOpen ? 'Chiudi' : 'Riapri'}
      </button>
    </div>`;
}

function buildCard(ev) {
  const card = document.createElement('div');
  card.className = 'event-card';
  card.id = `card-${ev.id}`;
  const count = ev.media_count || 0;
  const archived = ev.status === 'archived';
  const url = `${location.origin}/?e=${ev.id}`;

  card.innerHTML = `
    <div class="event-summary" data-action="toggle-card" data-id="${ev.id}">
      <div class="event-info">
        <h3>${escHtml(ev.name)}</h3>
        <div class="event-meta">
          ${formatDate(ev.event_date)} &middot; ${count} file &middot;
          <span class="status-badge status-${ev.status}">${STATUS_LABELS[ev.status]}</span>
        </div>
      </div>
      <div class="card-chevron">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
    </div>

    <div class="event-detail">
      <div class="event-detail-inner">
        <div class="detail-body">

          <!-- Modifica informazioni -->
          <div class="detail-section">
            <div class="section-title">Informazioni evento</div>
            <form data-action="save-edit" data-id="${ev.id}">
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
              ${!archived ? `
                <button type="submit" class="btn btn-primary" style="width:100%">Salva modifiche</button>
                <div class="save-feedback" id="save-fb-${ev.id}"></div>
              ` : ''}
            </form>
          </div>

          <!-- QR code e link -->
          <div class="detail-section">
            <div class="section-title">QR Code &amp; link ospiti</div>
            <div class="qr-box" id="qr-${ev.id}"></div>
            <div class="link-box">${url}</div>
            <button class="btn btn-ghost" style="width:100%" data-action="download-qr" data-id="${ev.id}">
              Scarica QR (PNG)
            </button>
          </div>

          <!-- Caricamenti -->
          <div class="detail-section" id="upload-section-${ev.id}">
            <div class="section-title">Caricamenti ospiti</div>
            ${renderUploadSection(ev)}
          </div>

          <!-- Foto e video -->
          <div class="detail-section">
            <div class="section-title">
              Foto e video
              <span class="count-badge" id="count-badge-${ev.id}">${count}</span>
            </div>
            <div class="photo-strip" id="strip-${ev.id}">
              <div class="strip-empty">Caricamento…</div>
            </div>
          </div>

          <!-- Elimina -->
          <div class="detail-section">
            <div class="section-title danger">Zona pericolosa</div>
            <div id="delete-area-${ev.id}">
              <button class="btn-danger" data-action="delete-event" data-id="${ev.id}">
                Elimina evento e tutte le foto
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>`;

  return card;
}

// ---- Card open/close ----

function openCard(card, id) {
  card.classList.add('is-open');
  openCardId = id;

  if (!qrGenerated.has(id)) {
    qrGenerated.add(id);
    const qrEl = document.getElementById(`qr-${id}`);
    if (qrEl) {
      new QRCode(qrEl, {
        text: `${location.origin}/?e=${id}`,
        width: 180, height: 180,
        colorDark: '#2B2118', colorLight: '#FFFFFF'
      });
    }
  }

  if (!photosLoaded.has(id)) {
    photosLoaded.add(id);
    loadPhotoStrip(id);
  }
}

function closeCard(card) {
  card.classList.remove('is-open');
  openCardId = null;
}

// ---- Photo strip ----

async function loadPhotoStrip(eventId) {
  const strip = document.getElementById(`strip-${eventId}`);
  if (!strip) return;
  try {
    const res = await fetch(`/api/events/${eventId}/media`);
    const items = await res.json();
    if (!items.length) {
      strip.innerHTML = '<div class="strip-empty">Nessuna foto ancora.</div>';
      return;
    }
    strip.innerHTML = '';
    items.forEach((item, i) => {
      const thumb = document.createElement('div');
      thumb.className = 'strip-thumb';
      if (item.type === 'video') {
        const vid = document.createElement('video');
        vid.src = item.url; vid.muted = true; vid.preload = 'metadata';
        const badge = document.createElement('span');
        badge.className = 'video-badge'; badge.textContent = '▶';
        thumb.appendChild(vid); thumb.appendChild(badge);
      } else {
        const img = document.createElement('img');
        img.src = item.url; img.loading = 'lazy'; img.alt = '';
        thumb.appendChild(img);
      }
      thumb.addEventListener('click', () => openLightbox(items, i));
      strip.appendChild(thumb);
    });
  } catch {
    strip.innerHTML = '<div class="strip-empty">Impossibile caricare le foto.</div>';
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
  document.body.style.overflow = '';
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
  if (dx > 55) prevPhoto();
  else if (dx < -55) nextPhoto();
});

document.addEventListener('keydown', e => {
  if (!lb.classList.contains('show')) return;
  if (e.key === 'ArrowLeft') prevPhoto();
  else if (e.key === 'ArrowRight') nextPhoto();
  else if (e.key === 'Escape') closeLightbox();
});

// ---- Event delegation: clicks ----

document.getElementById('events-list').addEventListener('click', async e => {

  // Toggle card open/close
  const summaryEl = e.target.closest('[data-action="toggle-card"]');
  if (summaryEl) {
    const id = summaryEl.dataset.id;
    const card = document.getElementById(`card-${id}`);
    if (card.classList.contains('is-open')) {
      closeCard(card);
    } else {
      if (openCardId) {
        const prev = document.getElementById(`card-${openCardId}`);
        if (prev) closeCard(prev);
      }
      openCard(card, id);
    }
    return;
  }

  // Download QR
  const dlQrBtn = e.target.closest('[data-action="download-qr"]');
  if (dlQrBtn) {
    const id = dlQrBtn.dataset.id;
    const container = document.getElementById(`qr-${id}`);
    const canvas = container?.querySelector('canvas');
    const img = container?.querySelector('img');
    const dataUrl = canvas ? canvas.toDataURL('image/png') : (img?.src ?? null);
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl; a.download = `qr-${id}.png`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    return;
  }

  // Toggle upload open/closed
  const toggleBtn = e.target.closest('[data-action="toggle-upload"]');
  if (toggleBtn) {
    const id = toggleBtn.dataset.id;
    const nextStatus = toggleBtn.dataset.status === 'open' ? 'closed' : 'open';
    toggleBtn.disabled = true;
    try {
      const res = await fetch(`/api/admin/events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      if (!res.ok) throw new Error();
      const ev = allEvents.find(e => e.id === id);
      if (ev) ev.status = nextStatus;
      // Update upload section in place
      const section = document.getElementById(`upload-section-${id}`);
      if (section) {
        section.innerHTML = `<div class="section-title">Caricamenti ospiti</div>${renderUploadSection(ev)}`;
      }
      // Update header badge
      const card = document.getElementById(`card-${id}`);
      const badge = card?.querySelector('.status-badge');
      if (badge) { badge.className = `status-badge status-${nextStatus}`; badge.textContent = STATUS_LABELS[nextStatus]; }
    } catch {
      alert('Impossibile aggiornare lo stato. Riprova.');
      toggleBtn.disabled = false;
    }
    return;
  }

  // Delete — show inline confirm
  const delBtn = e.target.closest('[data-action="delete-event"]');
  if (delBtn) {
    const id = delBtn.dataset.id;
    document.getElementById(`delete-area-${id}`).innerHTML = `
      <div class="delete-confirm">
        <span class="delete-confirm-label">Sicuro? Questa azione è irreversibile.</span>
        <button class="btn btn-ghost" data-action="cancel-delete" data-id="${id}" style="padding:10px 18px">No</button>
        <button class="btn-confirm-del" data-action="confirm-delete" data-id="${id}">Sì, elimina</button>
      </div>`;
    return;
  }

  // Cancel delete
  const cancelDel = e.target.closest('[data-action="cancel-delete"]');
  if (cancelDel) {
    const id = cancelDel.dataset.id;
    document.getElementById(`delete-area-${id}`).innerHTML =
      `<button class="btn-danger" data-action="delete-event" data-id="${id}">Elimina evento e tutte le foto</button>`;
    return;
  }

  // Confirm delete
  const confirmDel = e.target.closest('[data-action="confirm-delete"]');
  if (confirmDel) {
    const id = confirmDel.dataset.id;
    confirmDel.disabled = true; confirmDel.textContent = '…';
    try {
      const res = await fetch(`/api/admin/events/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      allEvents = allEvents.filter(e => e.id !== id);
      if (openCardId === id) openCardId = null;
      const card = document.getElementById(`card-${id}`);
      if (card) {
        card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        card.style.opacity = '0'; card.style.transform = 'scale(0.97)';
        setTimeout(() => { card.remove(); if (!allEvents.length) renderEvents(); }, 300);
      }
    } catch {
      alert("Impossibile eliminare l'evento. Riprova.");
      loadEvents(openCardId);
    }
    return;
  }
});

// ---- Event delegation: form submit ----

document.getElementById('events-list').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target;
  if (form.dataset.action !== 'save-edit') return;

  const id = form.dataset.id;
  const data = {
    name: form.elements['name'].value.trim(),
    event_date: form.elements['event_date'].value,
    description: form.elements['description'].value
  };
  const btn = form.querySelector('button[type="submit"]');
  const fb = document.getElementById(`save-fb-${id}`);
  btn.disabled = true; btn.textContent = 'Salvataggio…';

  try {
    const res = await fetch(`/api/admin/events/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error();

    const ev = allEvents.find(e => e.id === id);
    if (ev) Object.assign(ev, data);

    // Update header in place
    const card = document.getElementById(`card-${id}`);
    if (card) {
      card.querySelector('.event-info h3').textContent = data.name;
      const meta = card.querySelector('.event-meta');
      if (meta) meta.innerHTML = `${formatDate(data.event_date)} &middot; ${ev?.media_count || 0} file &middot; <span class="status-badge status-${ev?.status}">${STATUS_LABELS[ev?.status]}</span>`;
    }

    btn.textContent = '✓ Salvato!';
    if (fb) fb.textContent = '';
    setTimeout(() => { btn.textContent = 'Salva modifiche'; btn.disabled = false; }, 2000);
  } catch {
    if (fb) fb.textContent = 'Errore durante il salvataggio. Riprova.';
    btn.textContent = 'Salva modifiche'; btn.disabled = false;
  }
});

// ---- Create new event ----

document.getElementById('new-event-btn').addEventListener('click', () => {
  document.getElementById('create-modal').classList.add('show');
});

document.getElementById('cancel-create').addEventListener('click', () => {
  document.getElementById('create-modal').classList.remove('show');
});

document.getElementById('create-form').addEventListener('submit', async e => {
  e.preventDefault();
  const name = document.getElementById('new-name').value.trim();
  const date = document.getElementById('new-date').value;
  const btn = document.getElementById('create-submit');
  btn.disabled = true; btn.textContent = 'Creazione…';

  try {
    const res = await fetch('/api/admin/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, eventDate: date })
    });
    if (!res.ok) throw new Error();
    const newEv = await res.json();
    document.getElementById('create-modal').classList.remove('show');
    e.target.reset();
    // Reload and open the new card so user sees the QR immediately
    await loadEvents(newEv.id);
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

// ---- Init ----

loadEvents();
