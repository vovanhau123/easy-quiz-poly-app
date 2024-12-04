const sqlite3 = require('sqlite3').verbose();
const { fileDbPath } = require('../config/database');

const calculateUsedStorage = (userId) => {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(fileDbPath);
        
        db.get(
            'SELECT COALESCE(SUM(file_size), 0) as total_size FROM files WHERE user_id = ?',
            [userId],
            (err, row) => {
                db.close();
                if (err) reject(err);
                resolve(row?.total_size || 0);
            }
        );
    });
};

const getStorageInfo = async (req, res) => {
    try {
        const used = await calculateUsedStorage(req.user.id);
        const total = 5 * 1024 * 1024 * 1024; // 5GB in bytes
        const percentage = (used / total) * 100;

        res.json({
            used: used,
            total: total,
            percentage: Math.min(percentage, 100)
        });
    } catch (error) {
        console.error('Storage info error:', error);
        res.status(500).json({ error: 'Failed to get storage info' });
    }
};

module.exports = {
    getStorageInfo
}; 