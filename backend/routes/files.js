const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const db = require('../db');
const requireAuth = require('../middleware/auth');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Keep uploaded PDF in memory briefly, then stream it to Cloudinary.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB per PDF
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Sirf PDF files allowed hain'));
    }
    cb(null, true);
  },
});

router.use(requireAuth);

// List files, optionally filtered by folder_id and/or a search query (?q=).
router.get('/', (req, res) => {
  const { folder_id, q } = req.query;
  let sql = 'SELECT * FROM files WHERE 1=1';
  const params = [];

  if (folder_id) {
    sql += ' AND folder_id = ?';
    params.push(folder_id);
  }
  if (q) {
    sql += ' AND name LIKE ?';
    params.push(`%${q}%`);
  }
  sql += ' ORDER BY name';

  const files = db.prepare(sql).all(...params);
  res.json(files);
});

// Total storage used, in bytes.
router.get('/storage-usage', (req, res) => {
  const row = db.prepare('SELECT COALESCE(SUM(size_bytes), 0) as total FROM files').get();
  res.json({ total_bytes: row.total });
});

// Upload a PDF into a folder.
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'PDF file chahiye' });
    }
    const { folder_id, name } = req.body;

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw',
          folder: 'kutub-cloud',
          public_id: `${Date.now()}_${(name || req.file.originalname).replace(/\.pdf$/i, '')}`,
        },
        (err, result) => (err ? reject(err) : resolve(result))
      );
      stream.end(req.file.buffer);
    });

    const displayName = (name && name.trim()) || req.file.originalname;

    const inserted = db
      .prepare(
        'INSERT INTO files (name, folder_id, cloudinary_public_id, cloudinary_url, size_bytes) VALUES (?, ?, ?, ?, ?)'
      )
      .run(displayName, folder_id || null, result.public_id, result.secure_url, req.file.size);

    res.json({ id: inserted.lastInsertRowid, url: result.secure_url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload fail ho gaya: ' + err.message });
  }
});

// Rename a file.
router.put('/:id', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'File name chahiye' });
  }
  db.prepare('UPDATE files SET name = ? WHERE id = ?').run(name.trim(), req.params.id);
  res.json({ ok: true });
});

// Move a file to a different folder.
router.put('/:id/move', (req, res) => {
  const { folder_id } = req.body;
  db.prepare('UPDATE files SET folder_id = ? WHERE id = ?').run(folder_id || null, req.params.id);
  res.json({ ok: true });
});

// Delete a file (removes from Cloudinary too).
router.delete('/:id', async (req, res) => {
  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id);
  if (!file) return res.status(404).json({ error: 'File nahi mili' });

  try {
    await cloudinary.uploader.destroy(file.cloudinary_public_id, { resource_type: 'raw' });
  } catch (err) {
    console.error('Cloudinary delete warning:', err.message);
  }

  db.prepare('DELETE FROM files WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
