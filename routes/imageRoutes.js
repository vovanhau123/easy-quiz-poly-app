const express = require('express');
const router = express.Router();
const imageController = require('../controllers/imageController');
const authenticateToken = require('../middleware/auth');
const upload = require('../middleware/upload');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { fileDbPath } = require('../config/database');
const jwt = require('jsonwebtoken');

// Thêm routes cho folders
router.post('/folders', authenticateToken, imageController.createFolder);
router.get('/folders', authenticateToken, imageController.getFolders);

router.post('/upload', authenticateToken, upload.array('images', 50), imageController.uploadImages);
router.get('/images', authenticateToken, imageController.getUserImages);
router.get('/download/:imageId', authenticateToken, imageController.downloadImage);

// Route để lấy ảnh
router.get('/:fileId', async (req, res) => {
    const fileId = req.params.fileId;
    const token = req.query.token;

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;

        const db = new sqlite3.Database(fileDbPath);

        const file = await new Promise((resolve, reject) => {
            db.get(
                `SELECT f.*, fs.can_view_images 
                 FROM files f
                 LEFT JOIN folder_shares fs ON f.folder_id = fs.folder_id AND fs.user_id = ?
                 WHERE f.id = ? AND (
                    f.user_id = ? OR 
                    (fs.folder_id IS NOT NULL AND fs.can_view_images = 1)
                 )`,
                [userId, fileId, userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (!file) {
            db.close();
            return res.status(403).json({ error: 'Access denied or no permission to view images' });
        }

        db.close();
        res.sendFile(path.resolve(file.file_path));
    } catch (error) {
        console.error('Error serving file:', error);
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        res.status(500).json({ error: 'Failed to serve file' });
    }
});

module.exports = router; 