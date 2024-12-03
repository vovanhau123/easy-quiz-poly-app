module.exports = {
  apps: [{
    name: "image-upload-api",
    script: "app.js",
    env: {
      NODE_ENV: "production",
      PORT: 5500
    },
    instances: "max",
    exec_mode: "cluster",
    watch: false,
    max_memory_restart: "1G",
    error_file: "logs/err.log",
    out_file: "logs/out.log",
    log_file: "logs/combined.log",
    time: true
  }]
} 