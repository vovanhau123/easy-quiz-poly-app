const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authenticateToken = require('../middleware/auth');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/verify', authenticateToken, (req, res) => {
    res.json({ valid: true });
});

module.exports = router; 