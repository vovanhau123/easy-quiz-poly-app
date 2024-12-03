const sqlite3 = require('sqlite3').verbose();
const { fileDbPath } = require('../config/database');
const { secret } = require('../config/jwt');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const jwt = require('jsonwebtoken');

const createFolder = async (req, res) => {
    const { name, parentId } = req.body;
    const userId = req.user.id;
    const folderId = uuidv4();
    const db = new sqlite3.Database(fileDbPath);

    try {
        // Kiểm tra parent folder nếu có
        if (parentId) {
            const parentFolder = await new Promise((resolve, reject) => {
                db.get('SELECT * FROM folders WHERE id = ? AND user_id = ?', 
                    [parentId, userId], 
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });

            if (!parentFolder) {
                return res.status(404).json({ error: 'Parent folder not found' });
            }
        }

        const now = new Date().toISOString();
        // Tạo folder trong database với timestamp
        await new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO folders (id, name, parent_id, user_id, created_at) VALUES (?, ?, ?, ?, ?)',
                [folderId, name, parentId || null, userId, now],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        // Lấy thông tin folder vừa tạo
        const folder = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM folders WHERE id = ?',
                [folderId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        res.status(201).json({
            message: 'Folder created successfully',
            folder: folder
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        db.close();
    }
};

const getFolderContents = async (req, res) => {
    const { folderId } = req.params;
    const userId = req.user.id;
    const db = new sqlite3.Database(fileDbPath);

    console.log('Getting contents for folder:', folderId);
    console.log('User ID:', userId);

    try {
        // Get current folder info if folderId is provided
        let currentFolder = null;
        if (folderId) {
            currentFolder = await new Promise((resolve, reject) => {
                db.get(
                    'SELECT * FROM folders WHERE id = ? AND user_id = ?',
                    [folderId, userId],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });

            if (!currentFolder) {
                return res.status(404).json({ error: 'Folder not found' });
            }
        }

        // Get subfolders
        const folders = await new Promise((resolve, reject) => {
            let query;
            let params;

            if (folderId) {
                query = 'SELECT * FROM folders WHERE parent_id = ? AND user_id = ? ORDER BY created_at DESC';
                params = [folderId, userId];
            } else {
                query = 'SELECT * FROM folders WHERE parent_id IS NULL AND user_id = ? ORDER BY created_at DESC';
                params = [userId];
            }

            console.log('Folders query:', query);
            console.log('Query params:', params);

            db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // Get files
        const files = await new Promise((resolve, reject) => {
            let query;
            let params;

            if (folderId) {
                query = 'SELECT * FROM files WHERE folder_id = ? AND user_id = ? ORDER BY created_at DESC';
                params = [folderId, userId];
            } else {
                query = 'SELECT * FROM files WHERE folder_id IS NULL AND user_id = ? ORDER BY created_at DESC';
                params = [userId];
            }

            console.log('Files query:', query);
            console.log('Query params:', params);

            db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // Get folder path
        let folderPath = [];
        if (currentFolder) {
            let current = currentFolder;
            folderPath.unshift(current);

            while (current.parent_id) {
                current = await new Promise((resolve, reject) => {
                    db.get(
                        'SELECT * FROM folders WHERE id = ? AND user_id = ?',
                        [current.parent_id, userId],
                        (err, row) => {
                            if (err) reject(err);
                            else resolve(row);
                        }
                    );
                });
                if (current) {
                    folderPath.unshift(current);
                } else {
                    break;
                }
            }
        }

        // Send response
        return res.json({
            currentFolder,
            folderPath,
            folders,
            files
        });

    } catch (error) {
        console.error('Error in getFolderContents:', error);
        return res.status(500).json({ error: error.message });
    } finally {
        db.close();
    }
};

const uploadFiles = async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
    }

    const { folderId } = req.body;
    const userId = req.user.id;
    const db = new sqlite3.Database(fileDbPath);

    try {
        const now = new Date().toISOString();
        const values = req.files.map(file => {
            const fileId = path.parse(file.filename).name;
            return [
                fileId,
                file.filename,
                file.originalname,
                file.mimetype,
                file.size,
                folderId || null,
                userId,
                now // Thêm timestamp
            ];
        });

        const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
        const flatValues = values.flat();

        await new Promise((resolve, reject) => {
            const query = `INSERT INTO files (id, name, original_name, mime_type, size, folder_id, user_id, created_at) 
                VALUES ${placeholders}`;
            
            db.run(query, flatValues, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Lấy thông tin các file vừa upload
        const uploadedFiles = await Promise.all(values.map(async ([fileId]) => {
            return new Promise((resolve, reject) => {
                db.get(
                    'SELECT * FROM files WHERE id = ?',
                    [fileId],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });
        }));

        return res.json({
            message: 'Files uploaded successfully',
            files: uploadedFiles
        });
    } catch (error) {
        console.error('Upload error:', error);
        return res.status(500).json({ error: error.message });
    } finally {
        db.close();
    }
};

const downloadFile = async (req, res) => {
    const db = new sqlite3.Database(fileDbPath);
    const userId = req.user.id;
    const fileId = req.params.fileId;

    try {
        const file = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM files WHERE id = ? AND user_id = ?',
                [fileId, userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Tạo đường dẫn đến file
        const filePath = path.join(
            __dirname, 
            '..', 
            'uploads', 
            userId,
            file.folder_id || 'default',
            file.name
        );

        // Kiểm tra file có tồn tại
        try {
            await fs.access(filePath);
        } catch (error) {
            return res.status(404).json({ error: 'File not found on disk' });
        }

        // Gửi file về client
        res.download(filePath, file.original_name);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        db.close();
    }
};

const getFile = async (req, res) => {
    const token = req.query.token;
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    let db;
    try {
        // Verify token
        const decoded = jwt.verify(token, secret);
        const userId = decoded.id;
        const fileId = req.params.fileId;
        
        console.log('Getting file:', { userId, fileId }); // Debug log

        db = new sqlite3.Database(fileDbPath);

        const file = await new Promise((resolve, reject) => {
            const query = 'SELECT * FROM files WHERE id = ? AND user_id = ?';
            const params = [fileId, userId];
            
            console.log('File query:', query, params); // Debug log
            
            db.get(query, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        console.log('Found file:', file); // Debug log

        if (!file) {
            return res.status(404).json({ error: 'File not found in database' });
        }

        // Tạo đường dẫn đến file
        const filePath = path.join(
            __dirname,
            '..',
            'uploads',
            userId.toString(),
            file.name // Sử dụng tên file từ database
        );

        console.log('Attempting to access file at:', filePath); // Debug log

        // Kiểm tra file có tồn tại
        try {
            await fs.access(filePath);
            // Thêm headers để tránh cache
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            
            // Gửi file
            return res.sendFile(filePath, {
                headers: {
                    'Content-Type': file.mime_type
                }
            });
        } catch (error) {
            console.error('File access error:', error);
            return res.status(404).json({ error: 'File not found on disk' });
        }
    } catch (error) {
        console.error('Get file error:', error);
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        return res.status(500).json({ error: error.message });
    } finally {
        if (db) db.close();
    }
};

module.exports = {
    createFolder,
    getFolderContents,
    uploadFiles,
    downloadFile,
    getFile
}; 