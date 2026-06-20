const params = new URLSearchParams(window.location.search);
const eventId = params.get('e');

const galleryContent = document.getElementById('gallery-content');
const lightbox = document.getElementById('lightbox');
const lightboxMedia = document.getElementById('lightbox-media');

document.getElementById('lightbox-close').addEventListener('click', () => {
  lightbox.classList.remove('show');
  lightboxMedia.innerHTML = '';
});

function openLightbox(url, type) {
  lightboxMedia.innerHTML = type === 'video'
    ? `<video src="${url}" controls autoplay></video>`
    : `<img src="${url}" alt="">`;
  lightbox.classList.add('show');
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

  items.forEach(item => {
    const el = document.createElement('div');
    el.className = 'gallery-item';
    const media = document.createElement(item.type === 'video' ? 'video' : 'img');
    media.src = item.url;
    if (item.type === 'video') media.muted = true;
    el.appendChild(media);
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

  try {
    const eventRes = await fetch(`/api/events/${eventId}`);
    if (!eventRes.ok) throw new Error();
    const event = await eventRes.json();
    document.getElementById('event-name').textContent = event.name;

    if (event.zip_url) {
      const zipLink = document.getElementById('zip-link');
      zipLink.href = event.zip_url;
      zipLink.style.display = 'inline-flex';
    }

    const mediaRes = await fetch(`/api/events/${eventId}/media`);
    const items = await mediaRes.json();
    document.getElementById('event-count').textContent =
      items.length === 1 ? '1 ricordo condiviso' : `${items.length} ricordi condivisi`;
    renderGallery(items);
  } catch (err) {
    document.getElementById('event-name').textContent = 'Impossibile caricare la galleria';
  }
}

init();
