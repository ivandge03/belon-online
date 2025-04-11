const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 10000;

app.use(express.static(path.join(__dirname, 'public')));

let rooms = {};

const suits = ['spades', 'hearts', 'diamonds', 'clubs'];
const values = ['7', '8', '9', 'J', 'Q', 'K', '10', 'A'];

function shuffleDeck() {
  const deck = [];
  suits.forEach(suit => values.forEach(value => deck.push({ suit, value })));
  return deck.sort(() => Math.random() - 0.5);
}

function restartGame(roomCode) {
  const room = rooms[roomCode];
  const deck = shuffleDeck();
  const hands = [[], [], [], []];

  // Коректно раздаване по 5 карти на играч (общо 20)
  for (let i = 0; i < 20; i++) hands[i % 4].push(deck[i]);

  room.gameState = {
    hands,
    trump: null,
    currentTurn: 0,
    table: [],
    points: [0, 0]
  };

  room.players.forEach((playerId, i) => {
    io.to(playerId).emit('yourHand', hands[i]);
    io.to(playerId).emit('playersHands', { myIndex: i, totalPlayers: 4 });
  });

  io.to(room.players[0]).emit('chooseTrump');
  io.to(roomCode).emit('startGame');
}

io.on('connection', (socket) => {
  socket.on('joinRoom', ({ roomCode, playerName }) => {
    if (!rooms[roomCode]) rooms[roomCode] = { players: [], names: [], gameState: {} };
    if (rooms[roomCode].players.length >= 4) return;

    rooms[roomCode].players.push(socket.id);
    rooms[roomCode].names.push(playerName);
    socket.join(roomCode);

    io.to(roomCode).emit('playersUpdate', rooms[roomCode].names);

    if (rooms[roomCode].players.length === 4) restartGame(roomCode);
  });

  socket.on('chooseTrump', ({ roomCode, suit }) => {
    const room = rooms[roomCode];
    room.gameState.trump = suit;
    io.to(roomCode).emit('trumpChosen', suit);
    io.to(room.players[room.gameState.currentTurn]).emit('yourTurn');
  });

  socket.on('playCard', ({ roomCode, card }) => {
    const room = rooms[roomCode];
    const current = room.gameState.currentTurn;

    if (socket.id !== room.players[current]) return; // Проверка на ход

    room.gameState.table.push({ card, playerId: socket.id });
    room.gameState.hands[current] = room.gameState.hands[current].filter(c => c !== card);

    io.to(roomCode).emit('cardPlayed', { card, playerId: socket.id });

    if (room.gameState.table.length === 4) {
      room.gameState.table = [];
      room.gameState.currentTurn = (current + 1) % 4;
    } else {
      room.gameState.currentTurn = (current + 1) % 4;
    }

    io.to(room.players[room.gameState.currentTurn]).emit('yourTurn');
  });

  socket.on('disconnect', () => {
    for (let roomCode in rooms) {
      const index = rooms[roomCode].players.indexOf(socket.id);
      if (index >= 0) {
        rooms[roomCode].players.splice(index, 1);
        rooms[roomCode].names.splice(index, 1);
        io.to(roomCode).emit('playersUpdate', rooms[roomCode].names);
      }
    }
  });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

server.listen(PORT, () => console.log(`Сървърът работи на порт ${PORT}`));
