const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const { quizDbPath } = require('../config/database');

const searchQuestions = (query) => {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(quizDbPath);

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

router.get("/search", async (req, res) => {
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

module.exports = router; 