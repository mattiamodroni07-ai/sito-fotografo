import PhotoSwipeLightbox from 'https://cdn.jsdelivr.net/npm/photoswipe@5/dist/photoswipe-lightbox.esm.min.js';

const params = new URLSearchParams(window.location.search);
const eventId = params.get('e');

const galleryContent = document.getElementById('gallery-content');
const zipBtn = document.getElementById('zip-link');
const filterBar = document.getElementById('filter-bar');

let isAdmin = false;
let allItems = [];
let currentFilter = 'all';
let eventName = 'galleria';

if (window.gsap && window.ScrollTrigger) window.gsap.registerPlugin(window.ScrollTrigger);

/* ---------- Smooth scroll (Lenis) + ScrollTrigger ---------- */
function initSmoothScroll() {
  if (!window.Lenis || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const lenis = new window.Lenis({ duration: 1.1, smoothWheel: true });
  function raf(t) { lenis.raf(t); requestAnimationFrame(raf); }
  requestAnimationFrame(raf);
  if (window.ScrollTrigger) {
    lenis.on('scroll', window.ScrollTrigger.update);
    window.gsap?.ticker.add((t) => lenis.raf(t * 1000));
    window.gsap?.ticker.lagSmoothing(0);
  }
}

/* ---------- PhotoSwipe (foto + video) ---------- */
const pswp = new PhotoSwipeLightbox({
  pswpModule: () => import('https://cdn.jsdelivr.net/npm/photoswipe@5/dist/photoswipe.esm.min.js'),
  bgOpacity: 1,
  showHideAnimationType: 'zoom',
  wheelToZoom: true,
});

// Slide video: contenuto personalizzato
pswp.on('contentLoad', (e) => {
  const { content } = e;
  if (content.data.type === 'video') {
    e.preventDefault();
    content.element = document.createElement('div');
    content.element.className = 'pswp-video-wrap';
    const v = document.createElement('video');
    v.src = content.data.src;
    v.controls = true; v.playsInline = true; v.preload = 'metadata';
    content.element.appendChild(v);
  }
});
const pauseAllVideos = () => document.querySelectorAll('.pswp video').forEach(v => v.pause());
pswp.on('change', pauseAllVideos);
pswp.on('close', pauseAllVideos);
pswp.init();

function buildDataSource() {
  return visibleItems().map(it => it.type === 'video'
    ? { type: 'video', src: it.url, width: it._w || 1280, height: it._h || 720 }
    : { src: it.url, width: it._w || 1600, height: it._h || 1200 });
}

function openAt(index) {
  pswp.options.dataSource = buildDataSource();
  pswp.loadAndOpen(index);
}

/* ---------- Admin ---------- */
async function checkAdmin() {
  try { const res = await fetch('/api/admin/me'); return res.ok; }
  catch { return false; }
}

/* ---------- Download / Zip ---------- */
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
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  } catch { window.open(url, '_blank'); }
}

async function deleteMedia(mediaId) {
  if (!confirm('Sei sicuro di voler eliminare questo file? L\'azione è irreversibile.')) return;
  try {
    const res = await fetch(`/api/events/${eventId}/media/${mediaId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error();
    allItems = allItems.filter(i => i.id !== mediaId);
    updateCount(); refresh();
  } catch { alert('Impossibile eliminare il file. Riprova.'); }
}

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
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
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
    el.className = 'gallery-item';

    const media = document.createElement(item.type === 'video' ? 'video' : 'img');
    media.src = item.url;
    if (item.type === 'video') {
      media.muted = true; media.loop = true; media.playsInline = true; media.preload = 'metadata';
      media.addEventListener('loadedmetadata', () => { item._w = media.videoWidth; item._h = media.videoHeight; });
    } else {
      media.alt = '';
      media.addEventListener('load', () => { item._w = media.naturalWidth; item._h = media.naturalHeight; });
    }
    el.appendChild(media);

    const grad = document.createElement('div'); grad.className = 'grad'; el.appendChild(grad);
    if (item.type === 'video') {
      const b = document.createElement('span'); b.className = 'video-badge'; b.textContent = '▶ Video'; el.appendChild(b);
    }

    const overlay = document.createElement('div');
    overlay.className = 'item-overlay';

    const dlBtn = document.createElement('button');
    dlBtn.className = 'item-btn'; dlBtn.title = 'Scarica'; dlBtn.innerHTML = ICON_DOWNLOAD;
    dlBtn.addEventListener('click', (e) => { e.stopPropagation(); downloadFile(item.url, fileNameFor(item, index)); });
    overlay.appendChild(dlBtn);

    if (isAdmin) {
      const delBtn = document.createElement('button');
      delBtn.className = 'item-btn item-btn--danger'; delBtn.title = 'Elimina'; delBtn.innerHTML = ICON_DELETE;
      delBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteMedia(item.id); });
      overlay.appendChild(delBtn);
    }

    el.appendChild(overlay);
    el.addEventListener('click', () => openAt(index));
    grid.appendChild(el);
  });

  galleryContent.innerHTML = '';
  galleryContent.appendChild(grid);
  animateGrid();
}

function animateGrid() {
  if (!window.gsap || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const items = galleryContent.querySelectorAll('.gallery-item');
  window.gsap.set(items, { opacity: 0, y: 26 });
  if (window.ScrollTrigger) {
    window.ScrollTrigger.batch(items, {
      start: 'top 94%',
      onEnter: (els) => window.gsap.to(els, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.06, overwrite: true }),
    });
    requestAnimationFrame(() => window.ScrollTrigger.refresh());
  } else {
    window.gsap.to(items, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.05 });
  }
}

function visibleItems() {
  if (currentFilter === 'all') return allItems;
  return allItems.filter(i => i.type === currentFilter);
}
function refresh() { renderGallery(visibleItems()); }

filterBar.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  currentFilter = chip.dataset.filter;
  filterBar.querySelectorAll('.chip').forEach(c => c.classList.toggle('is-active', c === chip));
  refresh();
});

zipBtn.addEventListener('click', (e) => { e.preventDefault(); downloadAllZip(); });

/* ---------- Hero intro ---------- */
function animateHero() {
  if (!window.gsap || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  window.gsap.from('.hero .eyebrow, .hero h1, .hero p, .top-bar, .filter-bar', {
    opacity: 0, y: 18, duration: 0.8, ease: 'power3.out', stagger: 0.08,
  });
}

async function init() {
  initSmoothScroll();

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

    if (event.status === 'archived') {
      document.getElementById('event-count').textContent = '';
      galleryContent.innerHTML = `
        <div class="empty-state">
          <p>I ricordi di questo evento sono stati rimossi una settimana dopo la data dell'evento.</p>
        </div>`;
      animateHero();
      return;
    }

    updateCount();
    if (allItems.length > 0) filterBar.style.display = 'flex';
    refresh();
    animateHero();
  } catch {
    document.getElementById('event-name').textContent = 'Impossibile caricare la galleria';
  }
}

init();
