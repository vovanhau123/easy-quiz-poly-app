const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.get('/info', auth, async (req, res) => {
    try {
        // Lấy tổng dung lượng của tất cả files của user
        const result = await db.query(
            'SELECT COALESCE(SUM(file_size), 0) as total_size FROM files WHERE user_id = $1',
            [req.user.id]
        );

        const usedSpace = parseInt(result.rows[0].total_size) || 0;
        const totalSpace = 5 * 1024 * 1024 * 1024; // 5GB in bytes
        
        res.json({
            used: usedSpace,
            total: totalSpace,
            percentage: (usedSpace / totalSpace) * 100
        });
    } catch (error) {
        console.error('Error getting storage info:', error);
        res.status(500).json({ error: 'Failed to get storage info' });
    }
});

module.exports = router; 