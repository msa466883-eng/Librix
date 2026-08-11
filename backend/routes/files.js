const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

// Get Files Stats
router.get('/stats', requireAuth, (req, res) => {
    try {
        const foldersCount = db.prepare('SELECT COUNT(*) as count FROM folders').get().count;
        const filesCount = db.prepare('SELECT COUNT(*) as count FROM files').get().count;
        const totalSizeBytes = db.prepare('SELECT SUM(size_bytes) as total FROM files').get().total || 0;
        
        const totalStorageMB = totalSizeBytes / (1024 * 1024);

        res.json({
            foldersCount,
            filesCount,
            totalStorageMB
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a File
router.delete('/:id', requireAuth, (req, res) => {
    try {
        const fileId = req.params.id;
        db.prepare('DELETE FROM files WHERE id = ?').run(fileId);
        res.json({ message: 'File deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
