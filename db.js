const Database = require('better-sqlite3');
const path = require('path');

// SQLite file lives next to the backend code.
// On Render's free tier this resets on redeploy - folders/files metadata
// survives restarts but not redeploys unless you attach a persistent disk.
const db = new Database(path.join(__dirname, 'kutub.db'));

db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  parent_id INTEGER,
  musannif TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  folder_id INTEGER,
  cloudinary_public_id TEXT NOT NULL,
  cloudinary_url TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);
`);

// Seed the top-level structure from the user's requested layout, only once.
const seeded = db.prepare("SELECT COUNT(*) as c FROM folders").get();
if (seeded.c === 0) {
  const insertFolder = db.prepare(
    "INSERT INTO folders (name, parent_id, musannif) VALUES (?, ?, ?)"
  );
  const tafseer = insertFolder.run('Tafseer', null, null).lastInsertRowid;
  const ibnKathir = insertFolder.run('Imam Ibn Kathir', tafseer, 'Ibn Kathir').lastInsertRowid;
  insertFolder.run('Imam Tabari', tafseer, 'Tabari');

  const hadith = insertFolder.run('Hadith', null, null).lastInsertRowid;
  insertFolder.run('Imam Bukhari', hadith, 'Bukhari');
  insertFolder.run('Imam Muslim', hadith, 'Muslim');

  const fiqh = insertFolder.run('Fiqh', null, null).lastInsertRowid;
  insertFolder.run('Imam Abu Hanifa', fiqh, 'Abu Hanifa');
  insertFolder.run("Imam Shafi'i", fiqh, "Shafi'i");

  const nahw = insertFolder.run('Nahw', null, null).lastInsertRowid;
  insertFolder.run('Ibn Hisham', nahw, 'Ibn Hisham');
}

module.exports = db;
