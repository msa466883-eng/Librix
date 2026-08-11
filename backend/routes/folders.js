const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

// Get root content (folders & root files)
router.get('/root', requireAuth, (req, res) => {
    try {
        const folders = db.prepare('SELECT * FROM folders WHERE parent_id IS NULL').all();
        const files = db.prepare('SELECT * FROM files WHERE folder_id IS NULL').all();
        res.json({ folders: folders || [], files: files || [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get content inside a specific folder
router.get('/:id', requireAuth, (req, res) => {
    try {
        const folderId = req.params.id;
        const folders = db.prepare('SELECT * FROM folders WHERE parent_id = ?').all(folderId);
        const files = db.prepare('SELECT * FROM files WHERE folder_id = ?').all(folderId);
        res.json({ folders: folders || [], files: files || [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create a new folder
router.post('/', requireAuth, (req, res) => {
    try {
        const { name, parent_id } = req.body;
        if (!name) return res.status(400).json({ error: 'Folder name is required' });

        const stmt = db.prepare('INSERT INTO folders (name, parent_id) VALUES (?, ?)');
        const info = stmt.run(name, parent_id || null);
        
        res.json({ id: info.lastInsertRowid, name, parent_id: parent_id || null });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete folder and its content
router.delete('/:id', requireAuth, (req, res) => {
    try {
        const folderId = req.params.id;
        db.prepare('DELETE FROM files WHERE folder_id = ?').run(folderId);
        db.prepare('DELETE FROM folders WHERE id = ?').run(folderId);
        res.json({ message: 'Folder and contents deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
