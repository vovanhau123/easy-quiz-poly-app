const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const sqlite3 = require('sqlite3').verbose();
const { secret } = require('../config/jwt');
const { fileDbPath } = require('../config/database');

const register = async (req, res) => {
    const { username, password } = req.body;
    const userId = uuidv4();
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const db = new sqlite3.Database(fileDbPath);
        
        db.run('INSERT INTO users (id, username, password) VALUES (?, ?, ?)',
            [userId, username, hashedPassword],
            (err) => {
                db.close();
                if (err) {
                    if (err.message.includes('UNIQUE')) {
                        return res.status(400).json({ error: 'Username already exists' });
                    }
                    return res.status(500).json({ error: err.message });
                }
                res.status(201).json({ message: 'User created successfully' });
            }
        );
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const login = async (req, res) => {
    const { username, password } = req.body;
    const db = new sqlite3.Database(fileDbPath);

    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        db.close();
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(400).json({ error: 'User not found' });

        try {
            if (await bcrypt.compare(password, user.password)) {
                const token = jwt.sign(
                    { id: user.id, username: user.username }, 
                    secret,
                    { expiresIn: '24h' }
                );
                res.json({ token });
            } else {
                res.status(400).json({ error: 'Invalid password' });
            }
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
};

module.exports = {
    register,
    login
}; 