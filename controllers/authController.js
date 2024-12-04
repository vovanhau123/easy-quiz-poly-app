const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const sqlite3 = require("sqlite3").verbose();
const { secret } = require("../config/jwt");
const { fileDbPath } = require("../config/database");
const { sendVerificationEmail } = require("../utils/emailService");

// Hàm tạo mã xác thực ngẫu nhiên
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Hàm lấy IP của client
const getClientIP = (req) => {
  return (
    req.ip ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.connection.socket.remoteAddress
  );
};

const register = async (req, res) => {
  const { username, password, email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  const userId = uuidv4();
  const verificationCode = generateVerificationCode();
  const clientIP = getClientIP(req);

  try {
    const db = new sqlite3.Database(fileDbPath);

    // Kiểm tra email tồn tại
    const existingUser = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM users WHERE email = ?', [email], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });

    if (existingUser) {
      db.close();
      return res.status(400).json({ error: "Email already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Tạo user trước
    await new Promise((resolve, reject) => {
      db.run(`INSERT INTO users (
        id, username, password, email, verification_code, 
        last_login_ip, verified, is_logged_in
      ) VALUES (?, ?, ?, ?, ?, ?, 0, 0)`,
        [userId, username, hashedPassword, email, verificationCode, clientIP],
        (err) => {
          if (err) reject(err);
          resolve();
        }
      );
    });

    // Trả về response ngay sau khi tạo user
    res.status(201).json({ 
      message: "User created successfully. Please check your email for verification code."
    });

    // Gửi email sau khi đã trả response
    sendVerificationEmail(email, verificationCode).catch(error => {
      console.error("Error sending verification email:", error);
    });

    db.close();
  } catch (error) {
    db.close();
    res.status(500).json({ error: error.message });
  }
};

const verify = async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res
      .status(400)
      .json({ error: "Email and verification code are required" });
  }

  const db = new sqlite3.Database(fileDbPath);

  try {
    db.get(
      "SELECT * FROM users WHERE email = ? AND verification_code = ?",
      [email, code],
      (err, user) => {
        if (err) {
          db.close();
          return res.status(500).json({ error: err.message });
        }

        if (!user) {
          db.close();
          return res.status(400).json({ error: "Invalid verification code" });
        }

        // Kiểm tra xem tài khoản đã được xác thực chưa
        if (user.verified) {
          db.close();
          return res.status(400).json({ error: "Account already verified" });
        }

        // Cập nhật trạng thái xác thực
        db.run(
          "UPDATE users SET verified = 1, verification_code = NULL WHERE id = ?",
          [user.id],
          (err) => {
            db.close();
            if (err) {
              return res.status(500).json({ error: err.message });
            }
            res.json({
              message: "Account verified successfully",
              email: email,
            });
          }
        );
      }
    );
  } catch (error) {
    db.close();
    res.status(500).json({ error: error.message });
  }
};

const login = async (req, res) => {
  const { username, password } = req.body;
  const clientIP = getClientIP(req);
  const db = new sqlite3.Database(fileDbPath);

  db.get(
    "SELECT * FROM users WHERE username = ?",
    [username],
    async (err, user) => {
      if (err) {
        db.close();
        return res.status(500).json({ error: err.message });
      }

      if (!user) {
        db.close();
        return res.status(400).json({ error: "User not found" });
      }

      if (!user.verified) {
        db.close();
        return res.status(403).json({ error: "Account not verified" });
      }

      const currentTime = Date.now();
      if (
        user.login_attempts >= 5 &&
        currentTime - user.last_attempt_time < 15 * 60 * 1000
      ) {
        db.close();
        return res.status(429).json({
          error: "Too many login attempts. Please try again later.",
        });
      }

      try {
        if (await bcrypt.compare(password, user.password)) {
          const token = jwt.sign(
            { id: user.id, username: user.username },
            secret,
            { expiresIn: "24h" }
          );

          // Cập nhật trạng thái đăng nhập và IP
          db.run(
            `UPDATE users SET 
                    is_logged_in = 1, 
                    last_login_ip = ?,
                    login_attempts = 0
                    WHERE id = ?`,
            [clientIP, user.id]
          );

          db.close();
          res.json({ token });
        } else {
          // Tăng số lần thử đăng nhập thất bại
          db.run(
            `UPDATE users SET 
                    login_attempts = login_attempts + 1,
                    last_attempt_time = ?
                    WHERE id = ?`,
            [currentTime, user.id]
          );

          db.close();
          res.status(400).json({ error: "Invalid password" });
        }
      } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
      }
    }
  );
};

const logout = async (req, res) => {
  const userId = req.user.id; // Lấy từ middleware auth
  const db = new sqlite3.Database(fileDbPath);

  db.run("UPDATE users SET is_logged_in = 0 WHERE id = ?", [userId], (err) => {
    db.close();
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: "Logged out successfully" });
  });
};

const resendCode = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    const db = new sqlite3.Database(fileDbPath);

    try {
        // Kiểm tra user và thời gian gửi code gần nhất
        const user = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM users WHERE email = ? AND verified = 0',
                [email],
                (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                }
            );
        });

        if (!user) {
            db.close();
            return res.status(404).json({ error: 'User not found or already verified' });
        }

        // Tạo mã mới
        const newCode = generateVerificationCode();

        // Cập nhật mã mới
        await new Promise((resolve, reject) => {
            db.run(
                'UPDATE users SET verification_code = ? WHERE email = ?',
                [newCode, email],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });

        // Trả về response trước
        res.json({ message: 'Verification code resent successfully' });

        // Gửi email sau
        sendVerificationEmail(email, newCode).catch(error => {
            console.error('Error sending verification email:', error);
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        db.close();
    }
};

module.exports = {
  register,
  verify,
  login,
  logout,
  resendCode
};
