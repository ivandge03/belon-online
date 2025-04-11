// server.js
const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 10000;

app.use(express.static(path.join(__dirname, 'public')));

const suits = ['spades', 'hearts', 'diamonds', 'clubs'];
const values = ['7', '8', '9', 'J', 'Q', 'K', '10', 'A'];
const valuePoints = { '7': 0, '8': 0, '9': 14, 'J': 20, 'Q': 3, 'K': 4, '10': 10, 'A': 11 };
const valuePointsAllTrump = { '7': 0, '8': 0, '9': 14, 'J': 20, 'Q': 3, 'K': 4, '10': 10, 'A': 11 };
const valuePointsNoTrump = { '7': 0, '8': 0, '9': 0, 'J': 2, 'Q': 3, 'K': 4, '10': 10, 'A': 19 };

let rooms = {};

function shuffleDeck() {
  const deck = [];
  for (let suit of suits) {
    for (let value of values) {
      deck.push({ suit, value });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function restartGame(roomCode) {
  const room = rooms[roomCode];
  const deck = shuffleDeck();
  const hands = [[], [], [], []];

  for (let i = 0; i < 20; i++) {
    hands[i % 4].push(deck[i]);
  }

  room.gameState = {
    hands,
    trump: null,
    trumpChooser: 0,
    trumpRound: 1,
    currentTurn: 0,
    table: [],
    tableSuit: null,
    points: [0, 0],
    round: 0,
    playedThisRound: [],
    fullDeck: deck,
    names: room.names || []
  };

  for (let i = 0; i < 4; i++) {
    io.to(room.players[i]).emit('yourHand', hands[i]);
  }

  io.to(roomCode).emit('playersHands', { myIndex: 0, totalPlayers: 4 });
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

    if (rooms[roomCode].players.length === 4) {
      restartGame(roomCode);
    }
  });

  socket.on('chooseTrump', ({ roomCode, suit }) => {
    const room = rooms[roomCode];
    if (!room) return;
    room.gameState.trump = suit;

    // Дораздаване на останалите 3 карти на всеки
    for (let i = 0; i < 4; i++) {
      const extra = room.gameState.fullDeck.slice(20 + i * 3, 23 + i * 3);
      room.gameState.hands[i].push(...extra);
      io.to(room.players[i]).emit('yourHand', room.gameState.hands[i]);
    }

    const current = room.gameState.currentTurn;
    io.to(roomCode).emit('trumpChosen', suit);
    io.to(room.players[current]).emit('yourTurn');
  });

  socket.on('playCard', ({ roomCode, card }) => {
    const room = rooms[roomCode];
    if (!room) return;

    const current = room.gameState.currentTurn;
    const playerId = room.players[current];
    if (socket.id !== playerId) return;

    const playerIndex = room.players.indexOf(socket.id);
    const playerHand = room.gameState.hands[playerIndex];
    const table = room.gameState.table;

    const hasSuit = playerHand.some(c => c.suit === room.gameState.tableSuit);
    if (table.length > 0 && room.gameState.tableSuit && card.suit !== room.gameState.tableSuit && hasSuit) return;

    room.gameState.table.push({ card, playerId, index: playerIndex });
    room.gameState.hands[playerIndex] = playerHand.filter(
      c => c.suit !== card.suit || c.value !== card.value
    );

    if (table.length === 0) room.gameState.tableSuit = card.suit;

    io.to(roomCode).emit('cardPlayed', { card, playerId });

    if (room.gameState.table.length === 4) {
      const winner = room.gameState.table[0]; // просто за тест, трябва реална логика
      const winningPlayerIndex = winner.index;
      const team = winningPlayerIndex % 2;
      const pointSum = room.gameState.table.reduce((sum, entry) => {
        return sum + (valuePoints[entry.card.value] || 0);
      }, 0);

      room.gameState.points[team] += pointSum;
      room.gameState.table = [];
      room.gameState.tableSuit = null;
      room.gameState.currentTurn = winningPlayerIndex;
      room.gameState.round++;

      io.to(roomCode).emit('roundWinner', {
        winner: room.names[winningPlayerIndex],
        team,
        points: pointSum,
        teamPoints: room.gameState.points
      });

      if (room.gameState.points[team] >= 151) {
        io.to(roomCode).emit('gameOver', {
          team0: room.gameState.points[0],
          team1: room.gameState.points[1],
          winner: `Отбор ${team + 1}`
        });
      } else {
        setTimeout(() => {
          io.to(room.players[room.gameState.currentTurn]).emit('yourTurn');
        }, 1000);
      }
    } else {
      room.gameState.currentTurn = (current + 1) % 4;
      io.to(room.players[room.gameState.currentTurn]).emit('yourTurn');
    }
  });

  socket.on('disconnect', () => {
    for (const roomCode in rooms) {
      const room = rooms[roomCode];
      const index = room.players.indexOf(socket.id);
      if (index !== -1) {
        room.players.splice(index, 1);
        room.names.splice(index, 1);
        io.to(roomCode).emit('playersUpdate', room.names);
      }
    }
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`Сървърът работи на порт ${PORT}`);
});
