const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = 5500;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const searchQuestions = (query) => {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database("quiz_database.sqlite");

    // Cải tiến tìm kiếm: ưu tiên khớp chính xác, sau đó là khớp từng phần
    const exactQuery = query;
    const partialQuery = `%${query}%`;

    db.all(
      `
            SELECT question, answer, courseName, courseCode,
            CASE 
                WHEN question = ? THEN 1 
                WHEN question LIKE ? THEN 2
                ELSE 3 
            END as match_quality
            FROM questions 
            WHERE 
                question = ? OR 
                question LIKE ? OR 
                answer LIKE ? OR 
                courseName LIKE ? OR 
                courseCode LIKE ?
            ORDER BY match_quality
            LIMIT 20
        `,
      [
        exactQuery,
        partialQuery,
        exactQuery,
        partialQuery,
        partialQuery,
        partialQuery,
        partialQuery,
      ],
      (err, rows) => {
        db.close();
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      }
    );
  });
};

app.get("/search", async (req, res) => {
  const query = req.query.q || "";

  if (query.length < 2) {
    return res.json({ results: [], message: "Query too short" });
  }

  try {
    const results = await searchQuestions(query);
    res.json({
      results: results,
      total_results: results.length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Search failed", details: error.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT} and all network interfaces`);
});
