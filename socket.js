let io;

module.exports = {
    init: (httpServer) => {
        io = require('socket.io')(httpServer);
        
        io.on('connection', (socket) => {
            console.log('Client connected');

            socket.on('join-user-space', (userId) => {
                console.log('User joined space:', userId);
                socket.join(`user-${userId}`);
            });

            socket.on('disconnect', () => {
                console.log('Client disconnected');
            });
        });
        return io;
    },
    getIO: () => {
        if (!io) {
            throw new Error('Socket.io not initialized!');
        }
        return io;
    }
}; 