const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authenticateToken = require('../middleware/auth');

router.post('/register', authController.register);
router.post('/verify', authController.verify);
router.post('/login', authController.login);
router.post('/logout', authenticateToken, authController.logout);
router.get('/verify-token', authenticateToken, (req, res) => {
    res.json({ valid: true });
});
router.post('/resend-code', authController.resendCode);

module.exports = router; 