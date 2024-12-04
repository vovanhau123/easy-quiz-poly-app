const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const authenticateToken = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const sqlite3 = require('sqlite3').verbose();
const { fileDbPath } = require('../config/database');

// Thêm hàm getFolderPath ở đầu file, sau các import
const getFolderPath = async (folderId, db, userId) => {
    const path = [];
    let current = folderId;

    try {
        while (current) {
            const folder = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT f.*, u.username as owner_name,
                     CASE WHEN f.user_id = ? THEN 1 ELSE 0 END as is_owner
                     FROM folders f
                     JOIN users u ON f.user_id = u.id
                     LEFT JOIN folder_shares fs ON f.id = fs.folder_id
                     WHERE f.id = ? AND (f.user_id = ? OR fs.user_id = ?)`,
                    [userId, current, userId, userId],
                    (err, row) => {
                        if (err) reject(err);
                        resolve(row);
                    }
                );
            });
            
            if (!folder) break;
            path.unshift(folder);
            current = folder.parent_id;
        }
        return path;
    } catch (error) {
        console.error('Error getting folder path:', error);
        return [];
    }
};

// Cấu hình multer cho upload files
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueId = uuidv4();
        cb(null, uniqueId + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Route tạo folder
router.post('/folders', authenticateToken, async (req, res) => {
    const { name, parentId } = req.body;
    const userId = req.user.id;
    const folderId = uuidv4();

    const db = new sqlite3.Database(fileDbPath);

    try {
        db.run(
            'INSERT INTO folders (id, name, parent_id, user_id) VALUES (?, ?, ?, ?)',
            [folderId, name, parentId || null, userId],
            (err) => {
                db.close();
                if (err) {
                    return res.status(500).json({ error: 'Failed to create folder' });
                }
                res.status(201).json({ 
                    message: 'Folder created successfully',
                    folderId: folderId
                });
            }
        );
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// Route lấy nội dung folder
router.get('/folders/:folderId?', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const folderId = req.params.folderId;

    const db = new sqlite3.Database(fileDbPath);

    try {
        // Get folders (bao gồm cả shared folders)
        const folders = await new Promise((resolve, reject) => {
            const query = `
                SELECT DISTINCT f.*, 
                    u.username as owner_name,
                    CASE 
                        WHEN f.user_id = ? THEN 1 
                        ELSE 0 
                    END as is_owner
                FROM folders f
                JOIN users u ON f.user_id = u.id
                LEFT JOIN folder_shares fs ON f.id = fs.folder_id
                WHERE (f.user_id = ? OR fs.user_id = ?)
                AND f.parent_id ${folderId ? '= ?' : 'IS NULL'}
                ORDER BY f.created_at DESC
            `;

            const params = folderId 
                ? [userId, userId, userId, folderId]
                : [userId, userId, userId];

            db.all(query, params, (err, rows) => {
                if (err) reject(err);
                resolve(rows || []);
            });
        });

        // Get files (bao gồm cả shared files)
        const files = await new Promise((resolve, reject) => {
            const query = `
                SELECT f.*, u.username as owner_name
                FROM files f
                JOIN users u ON f.user_id = u.id
                LEFT JOIN folder_shares fs ON f.folder_id = fs.folder_id
                WHERE (f.user_id = ? OR fs.user_id = ?)
                AND f.folder_id ${folderId ? '= ?' : 'IS NULL'}
            `;

            const params = folderId 
                ? [userId, userId, folderId]
                : [userId, userId];

            db.all(query, params, (err, rows) => {
                if (err) reject(err);
                resolve(rows || []);
            });
        });

        // Get current folder info
        let currentFolder = null;
        let folderPath = [];
        
        if (folderId) {
            currentFolder = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT f.*, u.username as owner_name,
                     CASE WHEN f.user_id = ? THEN 1 ELSE 0 END as is_owner
                     FROM folders f
                     JOIN users u ON f.user_id = u.id
                     WHERE f.id = ?`,
                    [userId, folderId],
                    (err, row) => {
                        if (err) reject(err);
                        resolve(row);
                    }
                );
            });

            if (currentFolder) {
                folderPath = await getFolderPath(folderId, db, userId);
            }
        }

        db.close();
        res.json({
            currentFolder,
            folderPath,
            folders,
            files
        });
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// Route lấy thông tin storage
router.get('/storage/info', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const db = new sqlite3.Database(fileDbPath);

    try {
        // Tính tổng dung lượng đã sử dụng
        const result = await new Promise((resolve, reject) => {
            db.get(
                'SELECT COALESCE(SUM(file_size), 0) as total_size FROM files WHERE user_id = ?',
                [userId],
                (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                }
            );
        });

        const used = result.total_size || 0;
        const total = 5 * 1024 * 1024 * 1024; // 5GB in bytes
        const percentage = (used / total) * 100;

        res.json({
            used,
            total,
            percentage: Math.min(percentage, 100)
        });
    } catch (error) {
        console.error('Error getting storage info:', error);
        res.status(500).json({ error: 'Failed to get storage info' });
    } finally {
        db.close();
    }
});

// Route upload files
router.post('/upload', authenticateToken, upload.array('files'), async (req, res) => {
    try {
        const files = req.files;
        const folderId = req.body.folderId || null;
        const userId = req.user.id;
        const db = new sqlite3.Database(fileDbPath);
        const results = [];

        for (const file of files) {
            const fileId = uuidv4();
            await new Promise((resolve, reject) => {
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
                        fileId,
                        file.filename,
                        file.originalname,
                        file.path,
                        file.mimetype,
                        file.size,
                        file.size,
                        folderId,
                        userId,
                        new Date().toISOString()
                    ],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });

            const fileInfo = await new Promise((resolve, reject) => {
                db.get('SELECT * FROM files WHERE id = ?', [fileId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            results.push(fileInfo);
        }

        db.close();
        res.json(results);
    } catch (error) {
        console.error('Error uploading files:', error);
        res.status(500).json({ error: 'Failed to upload files' });
    }
});

// Route download file
router.get('/download/:fileId', authenticateToken, async (req, res) => {
    const fileId = req.params.fileId;
    const db = new sqlite3.Database(fileDbPath);

    try {
        const file = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM files WHERE id = ?', [fileId], (err, row) => {
                db.close();
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        res.download(file.file_path, file.original_name);
    } catch (error) {
        console.error('Error downloading file:', error);
        res.status(500).json({ error: 'Failed to download file' });
    }
});

// Thêm route connect folder
router.post('/folders/connect', authenticateToken, async (req, res) => {
    const { folderId } = req.body;
    const userId = req.user.id;

    if (!folderId) {
        return res.status(400).json({ error: 'Folder ID is required' });
    }

    const db = new sqlite3.Database(fileDbPath);

    try {
        // Check if folder exists and get owner info
        db.get(
            `SELECT folders.*, users.username as owner_name 
             FROM folders 
             JOIN users ON folders.user_id = users.id 
             WHERE folders.id = ?`,
            [folderId],
            async (err, folder) => {
                if (err) {
                    db.close();
                    return res.status(500).json({ error: 'Database error' });
                }

                if (!folder) {
                    db.close();
                    return res.status(404).json({ error: 'Unknown Folder ID' });
                }

                // Don't allow connecting to own folders
                if (folder.user_id === userId) {
                    db.close();
                    return res.status(400).json({ error: 'Cannot connect to your own folder' });
                }

                // Check if already connected
                db.get(
                    'SELECT * FROM folder_shares WHERE folder_id = ? AND user_id = ?',
                    [folderId, userId],
                    (err, existingShare) => {
                        if (err) {
                            db.close();
                            return res.status(500).json({ error: 'Database error' });
                        }

                        if (existingShare) {
                            db.close();
                            return res.status(400).json({ error: 'Already connected to this folder' });
                        }

                        // Create new share
                        db.run(
                            'INSERT INTO folder_shares (folder_id, user_id) VALUES (?, ?)',
                            [folderId, userId],
                            (err) => {
                                db.close();
                                if (err) {
                                    return res.status(500).json({ error: 'Failed to connect to folder' });
                                }
                                res.json({ 
                                    message: 'Successfully connected to folder',
                                    folder: {
                                        id: folder.id,
                                        name: folder.name,
                                        owner: folder.owner_name
                                    }
                                });
                            }
                        );
                    }
                );
            }
        );
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// Get shares for a folder
router.get('/folders/:folderId/shares', authenticateToken, async (req, res) => {
    const { folderId } = req.params;
    const userId = req.user.id;
    const db = new sqlite3.Database(fileDbPath);

    try {
        // Check if user owns the folder
        const folder = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM folders WHERE id = ? AND user_id = ?', 
                [folderId, userId], 
                (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                });
        });

        if (!folder) {
            db.close();
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Get shares
        const shares = await new Promise((resolve, reject) => {
            db.all(`
                SELECT fs.*, u.username, u.email
                FROM folder_shares fs
                JOIN users u ON fs.user_id = u.id
                WHERE fs.folder_id = ?
            `, [folderId], (err, rows) => {
                if (err) reject(err);
                resolve(rows || []);
            });
        });

        db.close();
        res.json(shares);
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// Update share permissions
router.patch('/folders/:folderId/shares/:userId/permissions', authenticateToken, async (req, res) => {
    const { folderId, userId } = req.params;
    const { permission, value } = req.body;
    const ownerId = req.user.id;
    const db = new sqlite3.Database(fileDbPath);

    try {
        // Verify ownership
        const folder = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM folders WHERE id = ? AND user_id = ?', 
                [folderId, ownerId], 
                (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                });
        });

        if (!folder) {
            db.close();
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Update permission
        const field = permission === 'images' ? 'can_view_images' : 'can_view_videos';
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE folder_shares 
                SET ${field} = ? 
                WHERE folder_id = ? AND user_id = ?
            `, [value ? 1 : 0, folderId, userId], (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        db.close();
        res.json({ message: 'Permissions updated successfully' });
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// Remove share
router.delete('/folders/:folderId/shares/:userId', authenticateToken, async (req, res) => {
    const { folderId, userId } = req.params;
    const ownerId = req.user.id;
    const db = new sqlite3.Database(fileDbPath);

    try {
        // Verify ownership
        const folder = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM folders WHERE id = ? AND user_id = ?', 
                [folderId, ownerId], 
                (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                });
        });

        if (!folder) {
            db.close();
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Remove share
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM folder_shares WHERE folder_id = ? AND user_id = ?', 
                [folderId, userId], 
                (err) => {
                    if (err) reject(err);
                    resolve();
                });
        });

        db.close();
        res.json({ message: 'Share removed successfully' });
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// Các route khác...

module.exports = router; 