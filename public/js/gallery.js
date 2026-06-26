const params = new URLSearchParams(window.location.search);
const eventId = params.get('e');

const galleryContent = document.getElementById('gallery-content');
const lightbox = document.getElementById('lightbox');
const lightboxMedia = document.getElementById('lightbox-media');

let isAdmin = false;

document.getElementById('lightbox-close').addEventListener('click', () => {
  lightbox.classList.remove('show');
  lightboxMedia.innerHTML = '';
});

lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) {
    lightbox.classList.remove('show');
    lightboxMedia.innerHTML = '';
  }
});

function openLightbox(url, type) {
  lightboxMedia.innerHTML = type === 'video'
    ? `<video src="${url}" controls autoplay></video>`
    : `<img src="${url}" alt="">`;
  lightbox.classList.add('show');
}

async function checkAdmin() {
  try {
    const res = await fetch('/api/admin/me');
    return res.ok;
  } catch {
    return false;
  }
}

async function downloadFile(url, filename) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  } catch {
    window.open(url, '_blank');
  }
}

async function deleteMedia(mediaId, el) {
  if (!confirm('Sei sicuro di voler eliminare questo file? L\'azione è irreversibile.')) return;
  try {
    const res = await fetch(`/api/events/${eventId}/media/${mediaId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error();
    el.remove();
  } catch {
    alert('Impossibile eliminare il file. Riprova.');
  }
}

const ICON_DOWNLOAD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
const ICON_DELETE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>`;

function renderEmpty() {
  galleryContent.innerHTML = `
    <div class="empty-state">
      <p>Nessuna foto caricata ancora. Sii il primo a condividere un ricordo!</p>
    </div>`;
}

function renderGallery(items) {
  if (items.length === 0) return renderEmpty();

  const grid = document.createElement('div');
  grid.className = 'gallery-grid';

  items.forEach((item, index) => {
    const ext = item.type === 'video' ? 'mp4' : 'jpg';
    const filename = `ricordo-${String(index + 1).padStart(3, '0')}.${ext}`;

    const el = document.createElement('div');
    el.className = 'gallery-item';

    const media = document.createElement(item.type === 'video' ? 'video' : 'img');
    media.src = item.url;
    if (item.type === 'video') { media.muted = true; media.loop = true; }
    el.appendChild(media);

    const overlay = document.createElement('div');
    overlay.className = 'item-overlay';

    const dlBtn = document.createElement('button');
    dlBtn.className = 'item-btn';
    dlBtn.title = 'Scarica';
    dlBtn.innerHTML = ICON_DOWNLOAD;
    dlBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      downloadFile(item.url, filename);
    });
    overlay.appendChild(dlBtn);

    if (isAdmin) {
      const delBtn = document.createElement('button');
      delBtn.className = 'item-btn item-btn--danger';
      delBtn.title = 'Elimina';
      delBtn.innerHTML = ICON_DELETE;
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteMedia(item.id, el);
      });
      overlay.appendChild(delBtn);
    }

    el.appendChild(overlay);
    el.addEventListener('click', () => openLightbox(item.url, item.type));
    grid.appendChild(el);
  });

  galleryContent.innerHTML = '';
  galleryContent.appendChild(grid);
}

async function init() {
  if (!eventId) {
    document.getElementById('event-name').textContent = 'Link non valido';
    return;
  }

  isAdmin = await checkAdmin();

  try {
    const [eventRes, mediaRes] = await Promise.all([
      fetch(`/api/events/${eventId}`),
      fetch(`/api/events/${eventId}/media`)
    ]);

    if (!eventRes.ok) throw new Error();
    const event = await eventRes.json();
    document.getElementById('event-name').textContent = event.name;

    const zipLink = document.getElementById('zip-link');
    zipLink.href = `/api/events/${eventId}/zip`;
    zipLink.style.display = 'inline-flex';

    const items = await mediaRes.json();
    document.getElementById('event-count').textContent =
      items.length === 1 ? '1 ricordo condiviso' : `${items.length} ricordi condivisi`;
    renderGallery(items);
  } catch {
    document.getElementById('event-name').textContent = 'Impossibile caricare la galleria';
  }
}

init();
