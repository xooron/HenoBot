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
    status: 'waiting', // waiting, countdown, spinning
    winner: null,
    winningAngle: 0
};

app.post('/api/auth', (req, res) => {
    const { id, first_name, username, photo_url } = req.body;
    if (!users[id]) {
        users[id] = {
            id,
            first_name: first_name || "Gamer",
            username: username || "player",
            balance: 10.0, // Даем 10 TON при заходе
            photo_url: photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`
        };
    }
    res.json(users[id]);
});

app.get('/api/game-status', (req, res) => res.json(game));

app.post('/api/bet', (req, res) => {
    const { userId, amount } = req.body;
    const user = users[userId];

    if (!user || user.balance < amount) return res.status(400).json({ error: "Мало TON" });
    if (game.status === 'spinning') return res.status(400).json({ error: "Игра идет" });

    user.balance -= amount;
    const playerInGame = game.players.find(p => p.id === userId);
    if (playerInGame) {
        playerInGame.bet += amount;
    } else {
        game.players.push({
            id: user.id,
            name: user.first_name,
            username: user.username,
            photo_url: user.photo_url,
            bet: amount,
            color: `hsl(${Math.random() * 360}, 70%, 60%)` // Рандомный цвет сектора
        });
    }

    game.totalBank += amount;

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
    game.status = 'spinning';
    const random = Math.random() * game.totalBank;
    let cumulative = 0;
    let winner = game.players[0];

    for (const p of game.players) {
        cumulative += p.bet;
        if (random <= cumulative) { winner = p; break; }
    }

    // Расчет угла для плавной остановки
    const total = game.totalBank;
    let startAngle = 0;
    game.players.forEach(p => {
        const slice = (p.bet / total) * 360;
        if (p.id === winner.id) {
            game.winningAngle = 360 - (startAngle + (slice / 2));
        }
        startAngle += slice;
    });

    game.winner = winner;
    if (users[winner.id]) users[winner.id].balance += game.totalBank * 0.95;

    setTimeout(() => { resetGame(); }, 12000); // Сброс через 12 сек (8 спин + 4 показ)
}

function resetGame() {
    game = { players: [], totalBank: 0, timer: 15, status: 'waiting', winner: null, winningAngle: 0 };
}

app.listen(3000, () => console.log('Server started on port 3000'));
