// Prende il codice evento dall'URL: es. sito.pages.dev/?e=matrimonio-anna-marco
const params = new URLSearchParams(window.location.search);
const eventId = params.get('e');

const appContent = document.getElementById('app-content');
const toastEl = document.getElementById('toast');

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 3000);
}

function renderMissingEvent() {
  document.getElementById('event-name').textContent = 'Link non valido';
  appContent.innerHTML = `
    <div class="card closed-state">
      <div class="icon">🔍</div>
      <p>Questo link non corrisponde a nessun evento. Controlla il QR code o chiedi all'organizzatore un nuovo link.</p>
    </div>`;
}

function renderClosedEvent(event) {
  document.getElementById('event-name').textContent = event.name;
  document.getElementById('event-sub').textContent = 'I caricamenti per questo evento sono chiusi';
  appContent.innerHTML = `
    <div class="card closed-state">
      <div class="icon">📷</div>
      <p>Il termine per caricare foto e video è scaduto (1 giorno dalla festa). Puoi ancora vedere e scaricare tutti i ricordi dalla galleria.</p>
      <div style="margin-top:20px">
        <a href="/galleria.html?e=${event.id}" class="btn btn-primary">Guarda la galleria</a>
      </div>
    </div>`;
}

function renderOpenEvent(event) {
  document.getElementById('event-name').textContent = event.name;
  document.getElementById('event-sub').textContent = 'Carica le tue foto e i tuoi video — hai tempo fino a 1 giorno dalla festa';

  appContent.innerHTML = `
    <div class="upload-zone" id="upload-zone">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
      <div class="main-text">Tocca per scegliere le foto, o trascinale qui</div>
      <div class="sub-text">Puoi selezionare più file insieme</div>
      <input type="file" id="file-input" accept="image/*,video/*" multiple>
    </div>
    <div class="upload-status" id="upload-status"></div>
    <div class="preview-grid" id="preview-grid"></div>
    <div class="text-center" style="margin-top:8px">
      <a href="/galleria.html?e=${event.id}" class="btn btn-ghost">Vedi tutte le foto caricate</a>
    </div>
  `;

  const zone = document.getElementById('upload-zone');
  const input = document.getElementById('file-input');
  const grid = document.getElementById('preview-grid');
  const statusEl = document.getElementById('upload-status');

  // Contatore live dei caricamenti
  let total = 0, done = 0, failed = 0;
  function updateStatus() {
    if (total === 0) { statusEl.className = 'upload-status'; statusEl.textContent = ''; return; }
    const pending = total - done - failed;
    if (pending > 0) {
      statusEl.className = 'upload-status show';
      statusEl.textContent = `Caricamento in corso… ${done}/${total}`;
    } else if (failed === 0) {
      statusEl.className = 'upload-status show success';
      statusEl.textContent = total === 1
        ? '✓ Foto caricata con successo!'
        : `✓ Tutte le ${total} caricate con successo!`;
    } else {
      statusEl.className = 'upload-status show error';
      statusEl.textContent = `${done}/${total} caricate · ${failed} non riuscite`;
    }
  }

  zone.addEventListener('click', () => input.click());

  ['dragover', 'dragleave', 'drop'].forEach(evt => {
    zone.addEventListener(evt, (e) => {
      e.preventDefault();
      zone.classList.toggle('drag-over', evt === 'dragover');
    });
  });

  zone.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));
  input.addEventListener('change', (e) => handleFiles(e.target.files));

  function handleFiles(fileList) {
    Array.from(fileList).forEach(file => uploadFile(file));
  }

  function uploadFile(file) {
    const isVideo = file.type.startsWith('video/');
    const item = document.createElement('div');
    item.className = 'preview-item';

    const media = document.createElement(isVideo ? 'video' : 'img');
    media.src = URL.createObjectURL(file);
    if (isVideo) media.muted = true;
    item.appendChild(media);

    const overlay = document.createElement('div');
    overlay.className = 'progress-overlay';
    overlay.textContent = 'Invio…';
    item.appendChild(overlay);

    grid.prepend(item);

    total++;
    updateStatus();

    const formData = new FormData();
    formData.append('file', file);
    formData.append('eventId', eventId);

    fetch('/api/upload', { method: 'POST', body: formData })
      .then(res => {
        if (!res.ok) throw new Error('Upload fallito');
        item.classList.add('done');
        done++;
        updateStatus();
      })
      .catch(() => {
        overlay.textContent = 'Errore, riprova';
        failed++;
        updateStatus();
        showToast('Non è stato possibile caricare ' + file.name);
      });
  }
}

async function init() {
  if (!eventId) return renderMissingEvent();

  try {
    const res = await fetch(`/api/events/${eventId}`);
    if (!res.ok) return renderMissingEvent();
    const event = await res.json();

    if (event.status === 'open') {
      renderOpenEvent(event);
    } else {
      renderClosedEvent(event);
    }
  } catch (err) {
    renderMissingEvent();
  }
}

init();
