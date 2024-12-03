const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const authenticateToken = require('../middleware/auth');
const upload = require('../middleware/upload');
const sqlite3 = require('sqlite3').verbose();
const { fileDbPath } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

router.post('/folders', authenticateToken, fileController.createFolder);
router.get('/folders/:folderId?', authenticateToken, fileController.getFolderContents);
router.post('/upload', authenticateToken, upload.array('files'), async (req, res) => {
    try {
        const files = req.files;
        const folderId = req.body.folderId || null;
        const db = new sqlite3.Database(fileDbPath);
        const results = [];

        for (const file of files) {
            const result = await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO files (
                        id, 
                        name, 
                        original_name, 
                        file_path, 
                        mime_type, 
                        size, 
                        file_size,
                        folder_id, 
                        user_id, 
                        created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        uuidv4(),
                        file.filename,
                        file.originalname,
                        file.path,
                        file.mimetype,
                        file.size,
                        file.size,
                        folderId,
                        req.user.id,
                        new Date().toISOString()
                    ],
                    function(err) {
                        if (err) reject(err);
                        else {
                            db.get('SELECT * FROM files WHERE rowid = ?', [this.lastID], (err, row) => {
                                if (err) reject(err);
                                else resolve(row);
                            });
                        }
                    }
                );
            });
            results.push(result);
        }

        db.close();
        res.json(results);
    } catch (error) {
        console.error('Error uploading files:', error);
        res.status(500).json({ error: 'Failed to upload files' });
    }
});
router.get('/files/:fileId', fileController.getFile);
router.get('/download/:fileId', authenticateToken, fileController.downloadFile);

module.exports = router; 