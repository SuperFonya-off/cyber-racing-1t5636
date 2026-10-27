const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// Раздача статики из папки public
app.use(express.static(path.join(__dirname, 'public')));

const players = {};

io.on('connection', (socket) => {
  console.log(`[+] Подключился игрок: ${socket.id}`);

  // Вход игрока
  socket.on('joinGame', (data) => {
    players[socket.id] = {
      id: socket.id,
      nickname: data.nickname || `Racer_${socket.id.substring(0, 4)}`,
      color: data.color || '#ff0055',
      x: 0,
      y: 0.4,
      z: 0,
      rotationY: 0,
      speed: 0,
      lap: 1,
      checkpoint: 0
    };

    // Передаем подключившемуся текущее состояние
    socket.emit('initLocalPlayer', { id: socket.id, players });
    
    // Оповещаем остальных
    socket.broadcast.emit('playerJoined', players[socket.id]);
    io.emit('updateLeaderboard', getLeaderboard());
  });

  // Синхронизация движения (30 раз в секунду)
  socket.on('playerTransform', (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      players[socket.id].z = data.z;
      players[socket.id].rotationY = data.rotationY;
      players[socket.id].speed = data.speed;

      socket.broadcast.emit('playerMoved', players[socket.id]);
    }
  });

  // Обновление кругов
  socket.on('updateLapProgress', (data) => {
    if (players[socket.id]) {
      players[socket.id].lap = data.lap;
      players[socket.id].checkpoint = data.checkpoint;
      io.emit('updateLeaderboard', getLeaderboard());
    }
  });

  // Сообщения чата
  socket.on('sendChatMessage', (msg) => {
    if (players[socket.id]) {
      io.emit('receiveChatMessage', {
        nickname: players[socket.id].nickname,
        text: msg,
        color: players[socket.id].color
      });
    }
  });

  // Отключение игрока
  socket.on('disconnect', () => {
    console.log(`[-] Отключился игрок: ${socket.id}`);
    delete players[socket.id];
    io.emit('playerLeft', socket.id);
    io.emit('updateLeaderboard', getLeaderboard());
  });
});

function getLeaderboard() {
  return Object.values(players)
    .sort((a, b) => (b.lap * 100 + b.checkpoint) - (a.lap * 100 + a.checkpoint))
    .map(p => ({ nickname: p.nickname, lap: p.lap, color: p.color }));
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});