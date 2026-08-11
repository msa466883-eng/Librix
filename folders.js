const express = require('express');
const router = express.Router();
const db = require('../db');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

// Get the full folder tree (all folders, nested by parent_id).
// Frontend builds the tree UI from this flat list.
router.get('/', (req, res) => {
  const folders = db.prepare('SELECT * FROM folders ORDER BY name').all();
  res.json(folders);
});

// Create a new folder (optionally with a musannif/author tag).
router.post('/', (req, res) => {
  const { name, parent_id, musannif } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Folder name chahiye' });
  }
  const result = db
    .prepare('INSERT INTO folders (name, parent_id, musannif) VALUES (?, ?, ?)')
    .run(name.trim(), parent_id || null, musannif || null);
  res.json({ id: result.lastInsertRowid });
});

// Rename a folder.
router.put('/:id', (req, res) => {
  const { name, musannif } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Folder name chahiye' });
  }
  db.prepare('UPDATE folders SET name = ?, musannif = ? WHERE id = ?').run(
    name.trim(),
    musannif || null,
    req.params.id
  );
  res.json({ ok: true });
});

// Move a folder under a different parent.
router.put('/:id/move', (req, res) => {
  const { parent_id } = req.body;
  db.prepare('UPDATE folders SET parent_id = ? WHERE id = ?').run(
    parent_id || null,
    req.params.id
  );
  res.json({ ok: true });
});

// Delete a folder (and everything inside it, via ON DELETE CASCADE).
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM folders WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
