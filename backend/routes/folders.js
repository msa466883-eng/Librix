const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

// Get root content (folders & root files)
router.get('/root', requireAuth, (req, res) => {
    db.all('SELECT * FROM folders WHERE parent_id IS NULL', [], (err, folders) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.all('SELECT * FROM files WHERE folder_id IS NULL', [], (err, files) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ folders: folders || [], files: files || [] });
        });
    });
});

// Get content inside a specific folder
router.get('/:id', requireAuth, (req, res) => {
    const folderId = req.params.id;

    db.all('SELECT * FROM folders WHERE parent_id = ?', [folderId], (err, folders) => {
        if (err) return res.status(500).json({ error: err.message });

        db.all('SELECT * FROM files WHERE folder_id = ?', [folderId], (err, files) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ folders: folders || [], files: files || [] });
        });
    });
});

// Create a new folder
router.post('/', requireAuth, (req, res) => {
    const { name, parent_id } = req.body;
    if (!name) return res.status(400).json({ error: 'Folder name is required' });

    db.run(
        'INSERT INTO folders (name, parent_id) VALUES (?, ?)',
        [name, parent_id || null],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, name, parent_id: parent_id || null });
        }
    );
});

// Delete folder and its content
router.delete('/:id', requireAuth, (req, res) => {
    const folderId = req.params.id;

    db.run('DELETE FROM files WHERE folder_id = ?', [folderId], (err) => {
        if (err) return res.status(500).json({ error: err.message });

        db.run('DELETE FROM folders WHERE id = ?', [folderId], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Folder and contents deleted successfully' });
        });
    });
});

module.exports = router;
