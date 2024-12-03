require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const initDatabase = require("./utils/database");
const authRoutes = require("./routes/authRoutes");
const fileRoutes = require("./routes/fileRoutes");
const searchRoutes = require("./routes/searchRoutes");
const storageRoutes = require("./routes/storageRoutes");

const app = express();
const PORT = process.env.PORT || 5500;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "public")));

// Initialize database
initDatabase();

// Routes
app.use("/auth", authRoutes);
app.use("/api", fileRoutes);
app.use("/", searchRoutes);
app.use("/api/storage", storageRoutes);

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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT} and all network interfaces`);
});
