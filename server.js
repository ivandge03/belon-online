// ==== server.js ====

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
    remainingDeck: deck.slice(20),
    trump: null,
    trumpChooser: 0,
    trumpRound: 1,
    currentTurn: 0,
    table: [],
    points: [0, 0],
    announces: [[], [], [], []],
    cardsPlayedThisTurn: [false, false, false, false]
  };

  for (let i = 0; i < 4; i++) {
    io.to(room.players[i]).emit('yourHand', hands[i]);
  }

  io.to(roomCode).emit('startGame');
  io.to(roomCode).emit('dealAnimation', { count: 5 });
  io.to(room.players[0]).emit('chooseTrump');
  sendPlayersHands(roomCode);
}

function sendPlayersHands(roomCode) {
  const room = rooms[roomCode];
  room.players.forEach((playerId, index) => {
    io.to(playerId).emit('playersHands', {
      myIndex: index,
      totalPlayers: room.players.length
    });
  });
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

    if (suit) {
      room.gameState.trump = suit;
      io.to(roomCode).emit('trumpChosen', suit);

      const current = room.gameState.currentTurn;
      io.to(room.players[current]).emit('yourTurn');
    } else {
      room.gameState.trumpChooser++;
      if (room.gameState.trumpChooser >= 4) {
        io.to(roomCode).emit('gameOver', { team0: 0, team1: 0, winner: 'Никой не избра коз. Играта се анулира.' });
      } else {
        io.to(room.players[room.gameState.trumpChooser]).emit('chooseTrump');
      }
    }
  });

  socket.on('playCard', ({ roomCode, card }) => {
    const room = rooms[roomCode];
    if (!room) return;

    const current = room.gameState.currentTurn;
    const playerId = room.players[current];

    if (socket.id !== playerId) return; // ❌ Не е ред на този играч

    if (room.gameState.cardsPlayedThisTurn[current]) return; // ❌ Играчът вече е играл карта този ход

    room.gameState.cardsPlayedThisTurn[current] = true;
    room.gameState.table.push({ card, playerId });
    room.gameState.hands[current] = room.gameState.hands[current].filter(
      c => c.suit !== card.suit || c.value !== card.value
    );

    io.to(roomCode).emit('cardPlayed', { card, playerId });

    const nextPlayerIndex = (current + 1) % 4;
    room.gameState.currentTurn = nextPlayerIndex;

    const allPlayed = room.gameState.cardsPlayedThisTurn.every(val => val);

    if (allPlayed) {
      for (let i = 0; i < 4; i++) {
        if (room.gameState.remainingDeck.length > 0) {
          const newCard = room.gameState.remainingDeck.shift();
          room.gameState.hands[i].push(newCard);
          io.to(room.players[i]).emit('yourHand', room.gameState.hands[i]);
        }
      }

      io.to(roomCode).emit('dealAnimation', { count: 1 });

      // Изпрати текущите точки
      io.to(roomCode).emit('updateScore', {
        team0: room.gameState.points[0],
        team1: room.gameState.points[1],
      });

      room.gameState.cardsPlayedThisTurn = [false, false, false, false];

      setTimeout(() => {
        io.to(room.players[room.gameState.currentTurn]).emit('yourTurn');
      }, 1000);
    } else {
      io.to(room.players[room.gameState.currentTurn]).emit('yourTurn');
    }
  });

  socket.on('restartGame', (roomCode) => {
    if (rooms[roomCode]) restartGame(roomCode);
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
