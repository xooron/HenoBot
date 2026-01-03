const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

let users = {};
let game = {
    status: 'waiting', // waiting, countdown, spinning, result
    players: [],
    totalBank: 0,
    timer: 15,
    winner: null,
    winningAngle: 0,
    startTime: null
};

// Авторизация: выдаем 10 TON новым игрокам
app.post('/api/auth', (req, res) => {
    const { id, first_name, username, photo_url } = req.body;
    if (!users[id]) {
        users[id] = {
            id,
            name: first_name || "Игрок",
            username: username || "user",
            photo_url: photo_url || `https://ui-avatars.com/api/?name=${first_name}&background=random`,
            balance: 10.0 // Начальный баланс 10 TON
        };
    }
    res.json(users[id]);
});

app.get('/api/status', (req, res) => res.json(game));

app.post('/api/bet', (req, res) => {
    const { userId, amount } = req.body;
    const user = users[userId];

    if (!user || user.balance < amount || amount <= 0) return res.status(400).json({ error: "Ошибка" });
    if (game.status !== 'waiting' && game.status !== 'countdown') return res.status(400).json({ error: "Ставки закрыты" });

    user.balance -= amount;
    const pIdx = game.players.findIndex(p => p.id === userId);
    
    if (pIdx > -1) {
        game.players[pIdx].bet += amount;
    } else {
        game.players.push({
            id: user.id,
            name: user.name,
            photo_url: user.photo_url,
            bet: amount,
            color: `hsl(${Math.random() * 360}, 70%, 50%)`
        });
    }

    game.totalBank += amount;

    // Если 2 игрока и более — запускаем отчет
    if (game.players.length >= 2 && game.status === 'waiting') {
        startCountdown();
    }
    res.json({ success: true, balance: user.balance });
});

function startCountdown() {
    game.status = 'countdown';
    game.timer = 15;
    const interval = setInterval(() => {
        game.timer--;
        if (game.timer <= 0) {
            clearInterval(interval);
            startSpin();
        }
    }, 1000);
}

function startSpin() {
    game.status = 'spinning';
    const random = Math.random() * game.totalBank;
    let current = 0;
    let winner = game.players[0];

    for (const p of game.players) {
        current += p.bet;
        if (random <= current) { winner = p; break; }
    }

    // Расчет угла: 3600 (10 кругов) + угол сектора
    let angleAcc = 0;
    game.players.forEach(p => {
        const slice = (p.bet / game.totalBank) * 360;
        if (p.id === winner.id) {
            // Выбираем центр сектора победителя
            game.winningAngle = 360 - (angleAcc + slice / 2);
        }
        angleAcc += slice;
    });

    game.winner = winner;
    if (users[winner.id]) users[winner.id].balance += game.totalBank * 0.95; // 5% комиссия

    setTimeout(() => {
        game.status = 'result';
        setTimeout(() => {
            // Сброс игры
            game = { status: 'waiting', players: [], totalBank: 0, timer: 15, winner: null, winningAngle: 0 };
        }, 5000); // 5 сек показываем окно победителя
    }, 8500); // 8 сек крутится рулетка
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server on port ${PORT}`));
