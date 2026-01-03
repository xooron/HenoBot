const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

let users = {};
let gameState = {
    status: 'waiting', // waiting, countdown, spinning, result
    players: [],
    totalBank: 0,
    timer: 15,
    winner: null,
    winningAngle: 0,
    startTime: null
};

// Авторизация
app.post('/api/auth', (req, res) => {
    const { id, first_name, username, photo_url } = req.body;
    if (!users[id]) {
        users[id] = {
            id,
            name: first_name || "Игрок",
            username: username || "user",
            photo_url: photo_url || `https://ui-avatars.com/api/?name=${first_name}&background=random`,
            balance: 10.0 // Тот самый бонус 10 TON
        };
    }
    res.json(users[id]);
});

// Статус игры
app.get('/api/status', (req, res) => res.json(gameState));

// Ставка
app.post('/api/bet', (req, res) => {
    const { userId, amount } = req.body;
    const user = users[userId];

    if (!user || user.balance < amount || amount <= 0) return res.status(400).json({ error: "Ошибка ставки" });
    if (gameState.status === 'spinning' || gameState.status === 'result') return res.status(400).json({ error: "Игра идет" });

    user.balance -= amount;
    const pIdx = gameState.players.findIndex(p => p.id === userId);
    
    if (pIdx > -1) {
        gameState.players[pIdx].bet += amount;
    } else {
        gameState.players.push({
            id: user.id,
            name: user.name,
            username: user.username,
            photo_url: user.photo_url,
            bet: amount,
            color: `hsl(${Math.random() * 360}, 70%, 50%)`
        });
    }

    gameState.totalBank += amount;

    if (gameState.players.length >= 2 && gameState.status === 'waiting') {
        startCountdown();
    }
    res.json({ success: true, balance: user.balance });
});

function startCountdown() {
    gameState.status = 'countdown';
    gameState.timer = 15;
    const interval = setInterval(() => {
        gameState.timer--;
        if (gameState.timer <= 0) {
            clearInterval(interval);
            startSpin();
        }
    }, 1000);
}

function startSpin() {
    gameState.status = 'spinning';
    const random = Math.random() * gameState.totalBank;
    let current = 0;
    let winner = gameState.players[0];

    for (const p of gameState.players) {
        current += p.bet;
        if (random <= current) { winner = p; break; }
    }

    // Считаем угол
    let angleAcc = 0;
    gameState.players.forEach(p => {
        const slice = (p.bet / gameState.totalBank) * 360;
        if (p.id === winner.id) {
            gameState.winningAngle = 360 - (angleAcc + slice / 2);
        }
        angleAcc += slice;
    });

    gameState.winner = winner;
    if (users[winner.id]) users[winner.id].balance += gameState.totalBank * 0.95;

    setTimeout(() => {
        gameState.status = 'result';
        setTimeout(() => {
            gameState = { status: 'waiting', players: [], totalBank: 0, timer: 15, winner: null, winningAngle: 0 };
        }, 5000);
    }, 8500);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
