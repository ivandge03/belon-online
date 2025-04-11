// public/main.js

const socket = io();

function joinRoom() {
  const playerName = document.getElementById('playerName').value.trim();
  const roomCode = document.getElementById('roomCode').value.trim();
  if (playerName && roomCode) {
    socket.emit('joinRoom', { roomCode, playerName });
    document.getElementById('status').innerText = 'Изчакване на други играчи...';
  }
}

socket.on('playersUpdate', (players) => {
  document.getElementById('players').innerText =
    'Играчите в стаята:\n' + players.join('\n');
});

socket.on('startGame', () => {
  document.body.classList.add('game-started');
  document.getElementById('status').innerText = 'Играта започва!';
});

socket.on('yourHand', (cards) => {
  const handDiv = document.getElementById('hand');
  handDiv.innerHTML = '';
  cards.forEach(card => {
    const cardImg = document.createElement('div');
    cardImg.classList.add('card');
    cardImg.innerText = card.value + ' ' + card.suit;
    cardImg.onclick = () => playCard(card);
    handDiv.appendChild(cardImg);
  });
});

socket.on('chooseTrump', () => {
  document.getElementById('trumpChoice').style.display = 'block';
});

function sendTrump(suit) {
  const roomCode = document.getElementById('roomCode').value;
  socket.emit('chooseTrump', { roomCode, suit });
  document.getElementById('trumpChoice').style.display = 'none';
  document.getElementById('status').innerText = 'Козът е избран: ' + (suit || 'пропуснат');
}

socket.on('trumpChosen', (suit) => {
  document.getElementById('status').innerText = 'Козът е ' + suit;
});

socket.on('yourTurn', () => {
  document.getElementById('status').innerText = 'Ти си на ход';
});

function playCard(card) {
  const roomCode = document.getElementById('roomCode').value;
  socket.emit('playCard', { roomCode, card });
}

socket.on('cardPlayed', ({ card, playerId }) => {
  const tableDiv = document.getElementById('table');
  const cardDiv = document.createElement('div');
  cardDiv.classList.add('card');
  cardDiv.innerText = card.value + ' ' + card.suit;
  tableDiv.appendChild(cardDiv);
});

socket.on('roundWinner', ({ winnerId, points, teamPoints }) => {
  document.getElementById('status').innerText =
    `Ръката е взета от ${winnerId}\nТочки от ръката: ${points}\nОтбор 1: ${teamPoints[0]} / Отбор 2: ${teamPoints[1]}`;
});

socket.on('announces', (announces) => {
  const status = document.getElementById('status');
  announces.forEach(a => {
    const cards = a.cards.map(c => c.value + ' ' + c.suit).join(', ');
    const line = document.createElement('div');
    line.innerText = `Обява: ${a.type} -> ${cards}`;
    status.appendChild(line);
  });
});

socket.on('gameOver', ({ team0, team1, winner }) => {
  document.getElementById('status').innerText =
    `Играта приключи!\nОтбор 1: ${team0} точки\nОтбор 2: ${team1} точки\nПобедител: ${winner}`;
  const restartBtn = document.createElement('button');
  restartBtn.innerText = 'Нова игра';
  restartBtn.onclick = () => {
    const roomCode = document.getElementById('roomCode').value;
    socket.emit('restartGame', roomCode);
    restartBtn.remove();
  };
  document.getElementById('status').appendChild(restartBtn);
});
