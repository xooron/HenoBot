const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

let users = {};
let game = {
    status: 'waiting', 
    players: [],
    totalBank: 0,
    timer: 15,
    winner: null,
    winningAngle: 0
};

// Авторизация
app.post('/api/auth', (req, res) => {
    const { id, first_name, username, photo_url } = req.body;
    if (!id) return res.status(400).send();
    if (!users[id]) {
        users[id] = {
            id,
            name: first_name || "Gamer",
            username: username || "user",
            photo_url: photo_url || `https://ui-avatars.com/api/?name=${first_name || 'U'}&background=random`,
            balance: 10.0
        };
    }
    res.json(users[id]);
});

// Добавление тестового бота
app.post('/api/add-bot', (req, res) => {
    const botId = Math.floor(Math.random() * 9000) + 1000;
    const bot = {
        id: botId,
        name: "Test Bot " + botId,
        username: "bot_" + botId,
        photo_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${botId}`,
        balance: 100
    };
    users[botId] = bot;
    
    // Бот делает случайную ставку
    const amount = parseFloat((Math.random() * 2 + 0.5).toFixed(1));
    if (game.status === 'spinning' || game.status === 'result') return res.status(400).json({error: "Игра идет"});
    
    const pIdx = game.players.findIndex(p => p.id === botId);
    if (pIdx > -1) {
        game.players[pIdx].bet += amount;
    } else {
        game.players.push({
            id: bot.id, name: bot.name, username: bot.username,
            photo_url: bot.photo_url, bet: amount,
            color: `hsl(${Math.random() * 360}, 80%, 60%)`
        });
    }
    game.totalBank += amount;
    if (game.players.length >= 2 && game.status === 'waiting') {
        game.status = 'countdown'; game.timer = 15;
    }
    res.json({ success: true });
});

app.get('/api/status', (req, res) => res.json(game));

app.post('/api/bet', (req, res) => {
    const { userId, amount } = req.body;
    const user = users[userId];
    if (!user || user.balance < amount) return res.status(400).json({ error: "Мало TON" });
    if (game.status === 'spinning' || game.status === 'result') return res.status(400).json({ error: "Игра идет" });

    user.balance -= amount;
    const pIdx = game.players.findIndex(p => p.id === userId);
    if (pIdx > -1) game.players[pIdx].bet += amount;
    else game.players.push({
        id: user.id, name: user.name, username: user.username,
        photo_url: user.photo_url, bet: amount,
        color: `hsl(${Math.random() * 360}, 80%, 60%)`
    });

    game.totalBank += amount;
    if (game.players.length >= 2 && game.status === 'waiting') {
        game.status = 'countdown'; game.timer = 15;
    }
    res.json({ success: true, balance: user.balance });
});

setInterval(() => {
    if (game.status === 'countdown') {
        game.timer--;
        if (game.timer <= 0) {
            game.status = 'spinning';
            const random = Math.random() * game.totalBank;
            let current = 0; let winner = game.players[0];
            for (const p of game.players) {
                current += p.bet;
                if (random <= current) { winner = p; break; }
            }
            let angleAcc = 0;
            game.players.forEach(p => {
                const slice = (p.bet / game.totalBank) * 360;
                if (p.id === winner.id) game.winningAngle = 360 - (angleAcc + slice / 2);
                angleAcc += slice;
            });
            game.winner = winner;
            if (users[winner.id]) users[winner.id].balance += game.totalBank * 0.95;
            setTimeout(() => {
                game.status = 'result';
                setTimeout(() => {
                    game = { status: 'waiting', players: [], totalBank: 0, timer: 15, winner: null, winningAngle: 0 };
                }, 5000);
            }, 8500);
        }
    }
}, 1000);

app.listen(3000, () => console.log('Port 3000'));
