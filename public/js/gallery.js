const params = new URLSearchParams(window.location.search);
const eventId = params.get('e');

const galleryContent = document.getElementById('gallery-content');
const lightbox = document.getElementById('lightbox');
const lightboxMedia = document.getElementById('lightbox-media');
const zipBtn = document.getElementById('zip-link');

let isAdmin = false;
let allItems = [];
let currentFilter = 'all';
let eventName = 'galleria';

const filterBar = document.getElementById('filter-bar');

// Osservatore per l'animazione d'ingresso delle foto allo scroll
const io = ('IntersectionObserver' in window)
  ? new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' })
  : null;

document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });

function closeLightbox() {
  lightbox.classList.remove('show');
  lightboxMedia.innerHTML = '';
}

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

// Ricava l'estensione reale del file dall'URL (es. .../abc.png -> png)
function extOf(item) {
  const fromUrl = item.url.split('.').pop().split('?')[0].toLowerCase();
  if (fromUrl && fromUrl.length <= 4) return fromUrl;
  return item.type === 'video' ? 'mp4' : 'jpg';
}

function fileNameFor(item, index) {
  return `ricordo-${String(index + 1).padStart(3, '0')}.${extOf(item)}`;
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
    allItems = allItems.filter(i => i.id !== mediaId);
    updateCount();
    refresh();
  } catch {
    alert('Impossibile eliminare il file. Riprova.');
  }
}

// Comprime e scarica tutta la galleria come .zip, direttamente nel browser.
async function downloadAllZip() {
  if (allItems.length === 0 || zipBtn.dataset.busy) return;
  const original = zipBtn.innerHTML;
  zipBtn.dataset.busy = '1';
  zipBtn.style.pointerEvents = 'none';

  try {
    const { downloadZip } = await import('https://cdn.jsdelivr.net/npm/client-zip/index.js');

    async function* files() {
      for (let i = 0; i < allItems.length; i++) {
        zipBtn.innerHTML = `Preparazione… ${i + 1}/${allItems.length}`;
        const res = await fetch(allItems[i].url);
        yield { name: fileNameFor(allItems[i], i), input: res };
      }
    }

    const blob = await downloadZip(files()).blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${eventName}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  } catch {
    alert('Impossibile creare lo ZIP. Riprova o scarica le foto singolarmente.');
  } finally {
    zipBtn.innerHTML = original;
    zipBtn.style.pointerEvents = '';
    delete zipBtn.dataset.busy;
  }
}

const ICON_DOWNLOAD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
const ICON_DELETE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>`;

function updateCount() {
  document.getElementById('event-count').textContent =
    allItems.length === 1 ? '1 ricordo condiviso' : `${allItems.length} ricordi condivisi`;
  zipBtn.style.display = allItems.length > 0 ? 'inline-flex' : 'none';
  filterBar.style.display = allItems.length > 0 ? 'flex' : 'none';
}

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
    const el = document.createElement('div');
    el.className = 'gallery-item animate';

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
      downloadFile(item.url, fileNameFor(item, index));
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
    if (io) io.observe(el);
  });

  galleryContent.innerHTML = '';
  galleryContent.appendChild(grid);
}

// Mostra le foto in base al filtro attivo (Tutti / Foto / Video)
function visibleItems() {
  if (currentFilter === 'all') return allItems;
  return allItems.filter(i => i.type === currentFilter);
}

function refresh() {
  renderGallery(visibleItems());
}

filterBar.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  currentFilter = chip.dataset.filter;
  filterBar.querySelectorAll('.chip').forEach(c => c.classList.toggle('is-active', c === chip));
  refresh();
});

zipBtn.addEventListener('click', (e) => { e.preventDefault(); downloadAllZip(); });

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
    eventName = event.name;
    document.getElementById('event-name').textContent = event.name;

    allItems = await mediaRes.json();

    // Evento archiviato: i file sono stati rimossi dopo una settimana
    if (event.status === 'archived') {
      document.getElementById('event-count').textContent = '';
      galleryContent.innerHTML = `
        <div class="empty-state">
          <p>I ricordi di questo evento sono stati rimossi una settimana dopo la data dell'evento.</p>
        </div>`;
      return;
    }

    updateCount();
    if (allItems.length > 0) filterBar.style.display = 'flex';
    refresh();
  } catch {
    document.getElementById('event-name').textContent = 'Impossibile caricare la galleria';
  }
}

init();
