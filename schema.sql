-- Tabella utenti admin: il fotografo (e eventuali collaboratori futuri)
CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,   -- la password non si salva mai in chiaro, solo "criptata"
  created_at TEXT NOT NULL
);

-- Tabella sessioni: tiene traccia dei login attivi del fotografo
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (admin_id) REFERENCES admin_users(id)
);

-- Tabella eventi: ogni festa/evento creato dal fotografo
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,           -- codice univoco usato nel link/QR (es: "matrimonio-anna-marco")
  name TEXT NOT NULL,            -- nome evento mostrato agli invitati (es: "Matrimonio di Anna e Marco")
  event_date TEXT NOT NULL,      -- data dell'evento (formato YYYY-MM-DD)
  created_at TEXT NOT NULL,      -- quando è stato creato l'evento nel sistema
  upload_closes_at TEXT NOT NULL,-- quando si chiudono gli upload (event_date + 7 giorni)
  archive_at TEXT NOT NULL,      -- quando si genera lo zip e si avvisa il fotografo (event_date + 30 giorni)
  status TEXT NOT NULL DEFAULT 'open',  -- open | closed | archived
  zip_url TEXT,                  -- link allo zip finale, una volta generato
  description TEXT               -- note private del fotografo (location, ospiti…)
);

-- Tabella media: ogni foto/video caricato dagli invitati
CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,           -- id univoco del file
  event_id TEXT NOT NULL,        -- a quale evento appartiene
  file_key TEXT NOT NULL,        -- nome/percorso del file su R2
  file_type TEXT NOT NULL,       -- "image" o "video"
  uploaded_at TEXT NOT NULL,     -- quando è stato caricato
  FOREIGN KEY (event_id) REFERENCES events(id)
);

-- Indice per velocizzare le query "dammi tutti i file di questo evento"
CREATE INDEX IF NOT EXISTS idx_media_event ON media(event_id);
