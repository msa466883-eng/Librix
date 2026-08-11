const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

// Multer Setup
const upload = multer({ storage: multer.memoryStorage() });

// Cloudinary Config (Make sure credentials exist in .env)
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Get Files Stats
router.get('/stats', requireAuth, (req, res) => {
    try {
        const foldersCount = db.prepare('SELECT COUNT(*) as count FROM folders').get().count;
        const filesCount = db.prepare('SELECT COUNT(*) as count FROM files').get().count;
        const totalSizeBytes = db.prepare('SELECT SUM(size_bytes) as total FROM files').get().total || 0;
        
        const totalStorageMB = totalSizeBytes / (1024 * 1024);

        res.json({ foldersCount, filesCount, totalStorageMB });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Upload PDF Route
router.post('/upload', requireAuth, upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const folder_id = req.body.folder_id || null;

        // Upload to Cloudinary using stream
        const uploadStream = cloudinary.uploader.upload_stream(
            { resource_type: 'raw', folder: 'kutub_cloud' },
            (error, result) => {
                if (error) return res.status(500).json({ error: error.message });

                const stmt = db.prepare(
                    'INSERT INTO files (name, folder_id, cloudinary_public_id, cloudinary_url, size_bytes) VALUES (?, ?, ?, ?, ?)'
                );
                const info = stmt.run(
                    req.file.originalname,
                    folder_id,
                    result.public_id,
                    result.secure_url,
                    req.file.size
                );

                res.json({
                    id: info.lastInsertRowid,
                    name: req.file.originalname,
                    url: result.secure_url
                });
            }
        );

        uploadStream.end(req.file.buffer);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete File
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
