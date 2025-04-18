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

socket.on('playersUpdate', (names) => {
  document.getElementById('players').innerHTML = `Играчи (${names.length}):<br>${names.join('<br>')}`;
});

socket.on('startGame', () => {
  document.getElementById('login').classList.add('hidden');
  document.getElementById('scoreboard').classList.remove('hidden');
  document.getElementById('status').innerText = 'Играта започна!';
});

socket.on('yourHand', (cards) => {
  const handDiv = document.getElementById('hand-bottom');
  handDiv.innerHTML = '';
  cards.forEach(card => {
    const cardDiv = document.createElement('div');
    cardDiv.classList.add('card');
    const img = document.createElement('img');
    img.src = `/images/cards/${card.value}_${card.suit}.png`;
    img.classList.add('card');
    cardDiv.appendChild(img);
    cardDiv.onclick = () => playCard(card);
    handDiv.appendChild(cardDiv);
  });
});

socket.on('playersHands', ({ myIndex, totalPlayers }) => {
  ['hand-top', 'hand-left', 'hand-right'].forEach(id => {
    document.getElementById(id).innerHTML = '';
  });

  const positions = ['bottom', 'right', 'top', 'left'];

  for (let i = 0; i < totalPlayers; i++) {
    if (i === myIndex) continue;
    const relativeIndex = (i - myIndex + 4) % 4;
    const posId = `hand-${positions[relativeIndex]}`;
    const handDiv = document.getElementById(posId);

    for (let j = 0; j < 5; j++) {
      const backImg = document.createElement('img');
      backImg.src = '/images/back.png';
      backImg.classList.add('card');
      handDiv.appendChild(backImg);
    }
  }
});

socket.on('chooseTrump', () => {
  document.getElementById('trumpChoice').classList.remove('hidden');
});

function sendTrump(suit) {
  const roomCode = document.getElementById('roomCode').value;
  socket.emit('chooseTrump', { roomCode, suit });
  document.getElementById('trumpChoice').classList.add('hidden');
  document.getElementById('status').innerText = `Козът е избран: ${suit || 'пропуснат'}`;
}

socket.on('trumpChosen', (suit) => {
  document.getElementById('status').innerText = `Козът е ${suit}`;
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
  const img = document.createElement('img');
  img.src = `/images/cards/${card.value}_${card.suit}.png`;
  img.classList.add('card');
  cardDiv.appendChild(img);
  tableDiv.appendChild(cardDiv);
});

socket.on('roundWinner', ({ winner, team, points, teamPoints }) => {
  document.getElementById('status').innerText = `Ръката е взета от ${winner} (Отбор ${team + 1})\nТочки от ръката: ${points}\nОтбор 1: ${teamPoints[0]} / Отбор 2: ${teamPoints[1]}`;
  document.getElementById('team1Score').innerText = teamPoints[0];
  document.getElementById('team2Score').innerText = teamPoints[1];
  document.getElementById('table').innerHTML = '';
});

socket.on('gameOver', ({ team0, team1, winner }) => {
  document.getElementById('status').innerText = `Играта приключи!\nОтбор 1: ${team0} точки\nОтбор 2: ${team1} точки\nПобедител: ${winner}`;
});
