const express = require('express');
const router = express.Router();
const imageController = require('../controllers/imageController');
const authenticateToken = require('../middleware/auth');
const upload = require('../middleware/upload');

// Thêm routes cho folders
router.post('/folders', authenticateToken, imageController.createFolder);
router.get('/folders', authenticateToken, imageController.getFolders);

router.post('/upload', authenticateToken, upload.array('images', 50), imageController.uploadImages);
router.get('/images', authenticateToken, imageController.getUserImages);
router.get('/download/:imageId', authenticateToken, imageController.downloadImage);

module.exports = router; 