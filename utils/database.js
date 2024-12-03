const sqlite3 = require('sqlite3').verbose();
const { quizDbPath, fileDbPath } = require('../config/database');

const initDatabase = () => {
    // Khởi tạo database cho quiz
    const quizDb = new sqlite3.Database(quizDbPath);
    quizDb.serialize(() => {
        quizDb.run(`CREATE TABLE IF NOT EXISTS questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question TEXT,
            answer TEXT,
            courseName TEXT,
            courseCode TEXT
        )`);
    });
    quizDb.close();

    // Khởi tạo database cho file storage
    const fileDb = new sqlite3.Database(fileDbPath);
    fileDb.serialize(() => {
        // Users table
        fileDb.run(`CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE,
            password TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Folders table
        fileDb.run(`CREATE TABLE IF NOT EXISTS folders (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            parent_id TEXT,
            user_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (parent_id) REFERENCES folders(id)
        )`);

        // Files table
        fileDb.run(`CREATE TABLE IF NOT EXISTS files (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            original_name TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            size INTEGER NOT NULL,
            folder_id TEXT,
            user_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (folder_id) REFERENCES folders(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);
    });
    fileDb.close();
};

module.exports = initDatabase; 