const express = require('express');
const app = express();

const storageRoutes = require('./routes/storageRoutes');
app.use('/api/storage', storageRoutes);

const folderRoutes = require('./routes/folderRoutes');
app.use('/api/folders', folderRoutes); 