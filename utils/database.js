const sqlite3 = require("sqlite3").verbose();
const { quizDbPath, fileDbPath } = require("../config/database");
const fs = require("fs");

const initDatabase = () => {
  // Kiểm tra và khởi tạo quiz database nếu chưa tồn tại
  if (!fs.existsSync(quizDbPath)) {
    console.log("Initializing quiz database...");
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
  }

  // Kiểm tra và khởi tạo file storage database nếu chưa tồn tại
  if (!fs.existsSync(fileDbPath)) {
    console.log("Initializing file storage database...");
    const fileDb = new sqlite3.Database(fileDbPath);
    fileDb.serialize(() => {
      // Users table
      fileDb.run(`CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE,
                password TEXT,
                email TEXT UNIQUE,
                verification_code TEXT,
                verified BOOLEAN DEFAULT 0,
                is_logged_in BOOLEAN DEFAULT 0,
                last_login_ip TEXT,
                login_attempts INTEGER DEFAULT 0,
                last_attempt_time INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

      // Folders table
      fileDb.run(`CREATE TABLE IF NOT EXISTS folders (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                parent_id TEXT,
                user_id TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (parent_id) REFERENCES folders(id)
            )`);

      // Files table
      fileDb.run(`CREATE TABLE IF NOT EXISTS files (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                original_name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                mime_type TEXT NOT NULL,
                size INTEGER NOT NULL,
                file_size INTEGER NOT NULL,
                folder_id TEXT,
                user_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (folder_id) REFERENCES folders(id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`);

      // Folder shares table
      fileDb.run(`CREATE TABLE IF NOT EXISTS folder_shares (
                folder_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (folder_id, user_id),
                FOREIGN KEY (folder_id) REFERENCES folders(id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`);

      // Thêm columns cho permissions
      fileDb.run(
        `ALTER TABLE folder_shares ADD COLUMN can_view_images INTEGER DEFAULT 1`
      );
      fileDb.run(
        `ALTER TABLE folder_shares ADD COLUMN can_view_videos INTEGER DEFAULT 1`
      );
    });
    fileDb.close();
  }
};

module.exports = initDatabase;
