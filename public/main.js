const socket = io();

function joinRoom() {
  const roomCode = document.getElementById('roomCode').value.trim();
  if (roomCode) {
    socket.emit('joinRoom', roomCode);
    document.getElementById('status').innerText = 'Изчакване на други играчи...';
  }
}


socket.on('playersUpdate', (players) => {
  document.getElementById('players').innerText = 'Играчите в стаята: ' + players.length;
});

socket.on('startGame', () => {
  document.getElementById('status').innerText = 'Играта започва!';
});

socket.on('yourHand', (cards) => {
  const handDiv = document.getElementById('hand');
  handDiv.innerHTML = '';
  cards.forEach(card => {
    const cardDiv = document.createElement('div');
    cardDiv.classList.add('card');
    cardDiv.innerText = card.value + ' ' + card.suit;
    cardDiv.onclick = () => playCard(card);
    handDiv.appendChild(cardDiv);
  });
});

socket.on('chooseTrump', () => {
  document.getElementById('trumpChoice').style.display = 'block';
});

function sendTrump(suit) {
  const roomCode = document.getElementById('roomCode').value;
  socket.emit('chooseTrump', { roomCode, suit });
  document.getElementById('trumpChoice').style.display = 'none';
  document.getElementById('status').innerText = 'Козът е избран: ' + suit;
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
    `Ръката е взета от ${winnerId}
Точки от ръката: ${points}
Отбор 1: ${teamPoints[0]} / Отбор 2: ${teamPoints[1]}`;
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
    `Играта приключи!
Отбор 1: ${team0} точки
Отбор 2: ${team1} точки
Победител: ${winner}`;
  const restartBtn = document.createElement('button');
  restartBtn.innerText = 'Нова игра';
  restartBtn.onclick = () => {
    const roomCode = document.getElementById('roomCode').value;
    socket.emit('restartGame', roomCode);
    restartBtn.remove();
  };
  document.getElementById('status').appendChild(restartBtn);
});
