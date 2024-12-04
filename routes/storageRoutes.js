const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const { getStorageInfo } = require('../controllers/storageController');

router.get('/info', authenticateToken, getStorageInfo);

module.exports = router; 