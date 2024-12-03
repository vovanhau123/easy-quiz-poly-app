const sqlite3 = require("sqlite3").verbose();
const { fileDbPath } = require("./config/database");

const db = {
  query: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      const database = new sqlite3.Database(fileDbPath);
      database.all(sql.replace(/\$\d+/g, "?"), params, (err, rows) => {
        database.close();
        if (err) reject(err);
        else resolve({ rows });
      });
    });
  },
};

module.exports = db;
