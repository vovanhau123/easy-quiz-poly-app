const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const folderController = require('../controllers/folderController');

// Existing routes
router.post('/', authenticateToken, folderController.createFolder);
router.get('/', authenticateToken, folderController.getFolders);

// New route for connecting to shared folders
router.post('/connect', authenticateToken, folderController.connectToFolder);

module.exports = router; 