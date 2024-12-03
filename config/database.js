const path = require('path');
require('dotenv').config();

module.exports = {
    quizDbPath: path.join(__dirname, '..', process.env.QUIZ_DB_PATH),
    fileDbPath: path.join(__dirname, '..', process.env.FILE_DB_PATH)
}; 