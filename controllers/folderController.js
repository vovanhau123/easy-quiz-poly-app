const sqlite3 = require('sqlite3').verbose();
const { fileDbPath } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const socket = require('../socket');

const createFolder = async (req, res) => {
    const { name, parentId } = req.body;
    const userId = req.user.id;
    const folderId = uuidv4();
    const created_at = new Date().toISOString();

    const db = new sqlite3.Database(fileDbPath);

    try {
        await new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO folders (id, name, parent_id, user_id, created_at) VALUES (?, ?, ?, ?, ?)',
                [folderId, name, parentId || null, userId, created_at],
                function(err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        const newFolder = {
            id: folderId,
            name: name,
            parent_id: parentId || null,
            user_id: userId,
            created_at: created_at,
            is_owner: true
        };

        // Emit event cho tất cả client của user này
        socket.getIO().to(`user-${userId}`).emit('folder-created', newFolder);
        
        res.status(201).json({
            message: 'Folder created successfully',
            folder: newFolder
        });

        db.close();
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
};

const connectToFolder = async (req, res) => {
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
};

// Cập nhật getFolders để bao gồm cả shared folders
const getFolders = async (req, res) => {
    const userId = req.user.id;
    const parentId = req.query.parentId || null;

    const db = new sqlite3.Database(fileDbPath);

    try {
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
            AND f.parent_id ${parentId ? '= ?' : 'IS NULL'}
            ORDER BY f.created_at DESC
        `;

        const params = parentId 
            ? [userId, userId, userId, parentId]
            : [userId, userId, userId];

        db.all(query, params, (err, folders) => {
            db.close();
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json(folders);
        });
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    createFolder,
    connectToFolder,
    getFolders
}; 