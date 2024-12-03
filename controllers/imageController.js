const sqlite3 = require('sqlite3').verbose();
const { dbPath } = require('../config/database');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;

const createFolder = async (req, res) => {
    const { folderName } = req.body;
    const userId = req.user.id;
    const folderId = uuidv4();
    const db = new sqlite3.Database(dbPath);

    try {
        const folderPath = path.join(__dirname, '..', 'uploads', userId, folderName);
        await fs.mkdir(folderPath, { recursive: true });

        await new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO folders (id, name, user_id) VALUES (?, ?, ?)',
                [folderId, folderName, userId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.status(201).json({ 
            message: 'Folder created successfully',
            folder: {
                id: folderId,
                name: folderName
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        db.close();
    }
};

const getFolders = async (req, res) => {
    const userId = req.user.id;
    const db = new sqlite3.Database(dbPath);

    db.all(
        'SELECT * FROM folders WHERE user_id = ? ORDER BY created_at DESC',
        [userId],
        (err, folders) => {
            db.close();
            if (err) return res.status(500).json({ error: err.message });
            res.json({ folders });
        }
    );
};

const uploadImages = async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
    }

    const db = new sqlite3.Database(dbPath);
    const folderName = req.body.folderName || 'default';
    const userId = req.user.id;
    
    try {
        const values = req.files.map(file => [
            uuidv4(),
            file.filename,
            folderName,
            userId,
            file.originalname
        ]);

        const placeholders = values.map(() => '(?, ?, ?, ?, ?)').join(', ');
        const flatValues = values.flat();

        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO images (id, filename, folder_name, user_id, original_name) 
                VALUES ${placeholders}`,
                flatValues,
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({ 
            message: 'Files uploaded successfully',
            files: req.files.map(file => ({
                filename: file.filename,
                originalName: file.originalname
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        db.close();
    }
};

const getUserImages = (req, res) => {
    const db = new sqlite3.Database(dbPath);
    const { folder } = req.query;
    const userId = req.user.id;

    let query = 'SELECT * FROM images WHERE user_id = ?';
    const params = [userId];

    if (folder && folder !== '/') {
        query += ' AND folder_name = ?';
        params.push(folder);
    }

    query += ' ORDER BY timestamp DESC';

    db.all(query, params, (err, images) => {
        db.close();
        if (err) return res.status(500).json({ error: err.message });
        res.json({ images });
    });
};

const downloadImage = async (req, res) => {
    const db = new sqlite3.Database(dbPath);

    db.get(
        'SELECT * FROM images WHERE id = ? AND user_id = ?',
        [req.params.imageId, req.user.id],
        async (err, image) => {
            db.close();
            if (err) return res.status(500).json({ error: err.message });
            if (!image) return res.status(404).json({ error: 'Image not found' });

            const filePath = path.join(__dirname, '..', 'uploads', req.user.id, image.folder_name, image.filename);
            try {
                res.download(filePath, image.original_name);
            } catch (error) {
                res.status(500).json({ error: 'File download failed' });
            }
        }
    );
};

module.exports = {
    createFolder,
    getFolders,
    uploadImages,
    getUserImages,
    downloadImage
}; 