require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const initDatabase = require("./utils/database");
const authRoutes = require("./routes/authRoutes");
const fileRoutes = require("./routes/fileRoutes");
const searchRoutes = require("./routes/searchRoutes");
const imageRoutes = require("./routes/imageRoutes");
const fs = require("fs");
const http = require("http");
const socket = require("./socket");

const app = express();
const PORT = process.env.PORT || 5500;
const server = http.createServer(app);

// Initialize socket.io
socket.init(server);

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "public")));

// Ensure uploads directory exists
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Initialize database
initDatabase();

// Routes
app.use("/auth", authRoutes);
app.use("/api", fileRoutes);
app.use("/", searchRoutes);
app.use("/api/files", imageRoutes);

// Route cho shared links
app.get('/shared/:folderId', (req, res) => {
    const folderId = req.params.folderId;
    
    // Trả về trang với meta tags động
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            
            <meta property="og:title" content="Shared Folder on Butterfly Drive">
            <meta property="og:description" content="Access shared files and folders securely with Butterfly Drive">
            <meta property="og:image" content="/images/butterfly-drive-preview.jpg">
            <meta property="og:url" content="${req.protocol}://${req.get('host')}${req.originalUrl}">
            <meta property="og:type" content="website">
            
            <meta name="twitter:card" content="summary_large_image">
            <meta name="twitter:title" content="Shared Folder on Butterfly Drive">
            <meta name="twitter:description" content="Access shared files and folders securely with Butterfly Drive">
            <meta name="twitter:image" content="/images/butterfly-drive-preview.jpg">
            
            <title>Butterfly Drive - Shared Folder</title>
            <script>
                window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
            </script>
        </head>
        <body>
            <p>Redirecting to shared folder...</p>
        </body>
        </html>
    `);
});

// Serve index.html for all other routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: err.message,
  });
});

// Thay đổi app.listen thành server.listen
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});

// Export io để sử dụng trong controllers
module.exports = app;
