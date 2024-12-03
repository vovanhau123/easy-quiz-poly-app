const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const authenticateToken = require('../middleware/auth');
const upload = require('../middleware/upload');
const db = require('../db');

router.post('/folders', authenticateToken, fileController.createFolder);
router.get('/folders/:folderId?', authenticateToken, fileController.getFolderContents);
router.post('/upload', authenticateToken, upload.array('files'), async (req, res) => {
    try {
        const files = req.files;
        const folderId = req.body.folderId || null;
        const results = [];

        for (const file of files) {
            const result = await db.query(
                'INSERT INTO files (original_name, file_path, mime_type, user_id, folder_id, file_size) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
                [
                    file.originalname,
                    file.path,
                    file.mimetype,
                    req.user.id,
                    folderId,
                    file.size
                ]
            );
            results.push(result.rows[0]);
        }

        res.json(results);
    } catch (error) {
        console.error('Error uploading files:', error);
        res.status(500).json({ error: 'Failed to upload files' });
    }
});
router.get('/files/:fileId', fileController.getFile);
router.get('/download/:fileId', authenticateToken, fileController.downloadFile);

module.exports = router; 