const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

let users = {};
let game = {
    players: [],
    totalBank: 0,
    timer: 15,
    status: 'waiting', // 'waiting', 'countdown', 'spinning'
    winner: null,
    winningAngle: 0
};

// Эндпоинт для авторизации
app.post('/api/auth', (req, res) => {
    const { id, first_name, username, photo_url } = req.body;
    if (!users[id]) {
        users[id] = {
            id,
            name: username ? `@${username}` : first_name,
            balance: 100.0, // Для теста даем 100 TON
            photo_url: photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`
        };
    }
    res.json(users[id]);
});

// Эндпоинт для получения статуса игры
app.get('/api/game-status', (req, res) => {
    res.json(game);
});

// Эндпоинт для ставки
app.post('/api/bet', (req, res) => {
    const { userId, amount } = req.body;
    const user = users[userId];

    if (!user || user.balance < amount) {
        return res.status(400).json({ error: "Недостаточно средств" });
    }

    if (game.status === 'spinning') {
        return res.status(400).json({ error: "Игра уже началась" });
    }

    // Снимаем баланс
    user.balance -= amount;

    // Добавляем в игру (если игрок уже ставил, прибавляем)
    const existingPlayer = game.players.find(p => p.id === userId);
    if (existingPlayer) {
        existingPlayer.bet += amount;
    } else {
        game.players.push({
            id: user.id,
            name: user.name,
            photo_url: user.photo_url,
            bet: amount
        });
    }

    game.totalBank += amount;

    // Логика запуска таймера
    if (game.players.length >= 2 && game.status === 'waiting') {
        startCountdown();
    }

    res.json({ success: true, newBalance: user.balance });
});

function startCountdown() {
    game.status = 'countdown';
    game.timer = 15;

    const interval = setInterval(() => {
        game.timer--;
        if (game.timer <= 0) {
            clearInterval(interval);
            calculateWinner();
        }
    }, 1000);
}

function calculateWinner() {
    if (game.players.length === 0) {
        resetGame();
        return;
    }

    game.status = 'spinning';
    
    // Выбираем победителя случайным образом на основе веса (ставки)
    const random = Math.random() * game.totalBank;
    let cumulative = 0;
    let winner = game.players[0];

    for (const player of game.players) {
        cumulative += player.bet;
        if (random <= cumulative) {
            winner = player;
            break;
        }
    }

    // Рассчитываем угол для анимации (чтобы указатель попал на сектор победителя)
    // Указатель сверху (на 270 градусах в Canvas), поэтому нужно смещение
    const total = game.totalBank;
    let startAngle = 0;
    game.players.forEach(p => {
        const slice = (p.bet / total) * 360;
        if (p.id === winner.id) {
            // Случайная точка внутри сектора победителя
            const randomPointInSlice = Math.random() * slice;
            // Угол вращения холста, чтобы этот сектор оказался вверху
            game.winningAngle = 360 - (startAngle + randomPointInSlice);
        }
        startAngle += slice;
    });

    game.winner = winner;

    // Выплачиваем выигрыш (за вычетом комиссии 5%)
    if (users[winner.id]) {
        users[winner.id].balance += game.totalBank * 0.95;
    }

    // Сброс игры через 10 сек после начала вращения (8с крутится + 2с показ)
    setTimeout(() => {
        resetGame();
    }, 11000);
}

function resetGame() {
    game = {
        players: [],
        totalBank: 0,
        timer: 15,
        status: 'waiting',
        winner: null,
        winningAngle: 0
    };
}

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Сервер: http://localhost:${PORT}`);
});
