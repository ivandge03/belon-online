const express = require('express'); 
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
    console.log(`Сървърът работи на порт ${PORT}`);
});
