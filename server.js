const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 10000;

// Тук казваме на Express да зарежда статични файлове от папката "public"
app.use(express.static(path.join(__dirname, 'public')));

server.listen(PORT, () => {
  console.log(`Сървърът работи на порт ${PORT}`);
});
