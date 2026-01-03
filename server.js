const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// База данных в оперативной памяти
let users = {};
let game = {
    players: [],
    totalBank: 0,
    status: 'waiting', // 'waiting', 'countdown', 'spinning', 'result'
    timer: 15,
    winner: null,
    winningAngle: 0,
    lastUpdate: Date.now()
};

// Авторизация и выдача 10 TON
app.post('/api/auth', (req, res) => {
    const { id, first_name, username, photo_url } = req.body;
    
    if (!users[id]) {
        users[id] = {
            id,
            first_name: first_name || "Игрок",
            username: username || "user",
            balance: 10.0, // Выдаем 10 TON при первом входе
            photo_url: photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`
        };
    }
    res.json(users[id]);
});

app.get('/api/game-status', (req, res) => {
    res.json(game);
});

app.post('/api/bet', (req, res) => {
    const { userId, amount } = req.body;
    const user = users[userId];

    if (!user || user.balance < amount) return res.status(400).json({ error: "Недостаточно TON" });
    if (game.status === 'spinning' || game.status === 'result') return res.status(400).json({ error: "Игра уже идет" });

    user.balance -= amount;
    
    const existingPlayer = game.players.find(p => p.id === userId);
    if (existingPlayer) {
        existingPlayer.bet += amount;
    } else {
        game.players.push({
            id: user.id,
            name: user.first_name,
            username: user.username,
            photo_url: user.photo_url,
            bet: amount,
            color: `hsl(${Math.random() * 360}, 70%, 50%)`
        });
    }

    game.totalBank += amount;

    if (game.players.length >= 2 && game.status === 'waiting') {
        game.status = 'countdown';
        game.timer = 15;
    }

    res.json({ success: true, newBalance: user.balance });
});

// Глобальный цикл игры (серверный таймер)
setInterval(() => {
    if (game.status === 'countdown') {
        game.timer--;
        if (game.timer <= 0) {
            startSpin();
        }
    }
}, 1000);

function startSpin() {
    game.status = 'spinning';
    
    // Выбор победителя
    const random = Math.random() * game.totalBank;
    let cumulative = 0;
    let winner = game.players[0];

    for (const p of game.players) {
        cumulative += p.bet;
        if (random <= cumulative) {
            winner = p;
            break;
        }
    }

    // Расчет угла остановки
    let currentAngle = 0;
    game.players.forEach(p => {
        const slice = (p.bet / game.totalBank) * 360;
        if (p.id === winner.id) {
            game.winningAngle = 360 - (currentAngle + (slice / 2));
        }
        currentAngle += slice;
    });

    game.winner = winner;
    if (users[winner.id]) users[winner.id].balance += game.totalBank * 0.95;

    // Время на вращение (8 сек) + показ результата (4 сек)
    setTimeout(() => {
        game.status = 'result';
        setTimeout(() => {
            resetGame();
        }, 4000);
    }, 8500);
}

function resetGame() {
    game = { players: [], totalBank: 0, status: 'waiting', timer: 15, winner: null, winningAngle: 0 };
}

app.listen(3000, () => console.log('Backend запущен на порту 3000'));
