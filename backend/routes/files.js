const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage() });

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// GET Stats for Admin Panel
router.get('/stats', requireAuth, (req, res) => {
    db.get('SELECT COUNT(*) as foldersCount FROM folders', [], (err, fRow) => {
        db.get('SELECT COUNT(*) as filesCount, SUM(size) as totalSize FROM files', [], (err, fileRow) => {
            res.json({
                foldersCount: fRow ? fRow.foldersCount : 0,
                filesCount: fileRow ? fileRow.filesCount : 0,
                totalStorageMB: fileRow && fileRow.totalSize ? (fileRow.totalSize / (1024 * 1024)) : 0
            });
        });
    });
});

// PDF Upload Endpoint
router.post('/upload', requireAuth, upload.single('pdf'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const folderId = req.body.folder_id || null;

    cloudinary.uploader.upload_stream(
        {
            resource_type: 'image',
            format: 'pdf',
            folder: 'kutub_cloud'
        },
        (error, result) => {
            if (error) return res.status(500).json({ error: error.message });

            db.run(
                'INSERT INTO files (name, url, public_id, folder_id, size) VALUES (?, ?, ?, ?, ?)',
                [req.file.originalname, result.secure_url, result.public_id, folderId, req.file.size],
                function (err) {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ id: this.lastID, name: req.file.originalname, url: result.secure_url });
                }
            );
        }
    ).end(req.file.buffer);
});

// Delete File
router.delete('/:id', requireAuth, (req, res) => {
    db.get('SELECT * FROM files WHERE id = ?', [req.params.id], (err, file) => {
        if (!file) return res.status(404).json({ error: 'File not found' });

        cloudinary.uploader.destroy(file.public_id, { resource_type: 'image' }, () => {
            db.run('DELETE FROM files WHERE id = ?', [req.params.id], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'File deleted successfully' });
            });
        });
    });
});

module.exports = router;
