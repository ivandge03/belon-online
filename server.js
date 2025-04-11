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

function dealCards(deck, numCards, playersCount) {
  const hands = Array.from({ length: playersCount }, () => []);
  for (let i = 0; i < numCards * playersCount; i++) {
    hands[i % playersCount].push(deck.shift());
  }
  return hands;
}

function restartGame(roomCode) {
  const room = rooms[roomCode];
  const deck = shuffleDeck();
  room.gameState = {
    deck,
    hands: dealCards(deck, 5, 4),
    trump: null,
    currentTurn: 0,
    table: [],
    points: [0, 0],
    wonCards: [[], []]
  };

  room.players.forEach((playerId, i) => {
    io.to(playerId).emit('yourHand', room.gameState.hands[i]);
    io.to(playerId).emit('playersHands', { myIndex: i, totalPlayers: 4 });
  });

  io.to(room.players[0]).emit('chooseTrump');
  io.to(roomCode).emit('startGame');
}

function dealAdditionalCards(roomCode) {
  const room = rooms[roomCode];
  const additionalCards = dealCards(room.gameState.deck, 3, 4);
  room.gameState.hands.forEach((hand, index) => hand.push(...additionalCards[index]));

  room.players.forEach((playerId, i) => {
    io.to(playerId).emit('yourHand', room.gameState.hands[i]);
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

    if (rooms[roomCode].players.length === 4) restartGame(roomCode);
  });

  socket.on('chooseTrump', ({ roomCode, suit }) => {
    const room = rooms[roomCode];
    room.gameState.trump = suit;
    io.to(roomCode).emit('trumpChosen', suit);
    dealAdditionalCards(roomCode);
    io.to(room.players[room.gameState.currentTurn]).emit('yourTurn');
  });

  socket.on('playCard', ({ roomCode, card }) => {
    const room = rooms[roomCode];
    const current = room.gameState.currentTurn;

    if (socket.id !== room.players[current]) return;

    room.gameState.table.push({ card, playerId: socket.id });
    room.gameState.hands[current] = room.gameState.hands[current].filter(c => !(c.value === card.value && c.suit === card.suit));

    io.to(roomCode).emit('cardPlayed', { card, playerId: socket.id });

    if (room.gameState.table.length === 4) {
      const winnerIndex = Math.floor(Math.random() * 4);
      const winningTeam = winnerIndex % 2;
      room.gameState.wonCards[winningTeam].push(...room.gameState.table);
      room.gameState.table = [];
      room.gameState.currentTurn = winnerIndex;
      io.to(roomCode).emit('roundWinner', { winner: room.names[winnerIndex], team: winningTeam });

      if (room.gameState.hands.every(hand => hand.length === 0)) {
        const teamScores = room.gameState.wonCards.map(cards => cards.length);
        io.to(roomCode).emit('gameOver', { scores: teamScores });
      }
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
