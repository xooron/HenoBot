const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Имитация базы данных
let users = {};

// Эндпоинт для авторизации/регистрации пользователя
app.post('/api/auth', (req, res) => {
    const { id, first_name, username } = req.body;
    
    if (!users[id]) {
        users[id] = {
            id,
            name: username ? `@${username}` : first_name,
            balance: 10.0, // Даем 10 TON при регистрации для теста
            inventory: [],
            refBalance: 0
        };
    }
    res.json(users[id]);
});

// Эндпоинт для покупки
app.post('/api/buy', (req, res) => {
    const { userId, itemType, price, imageUrl } = req.body;
    const user = users[userId];

    if (!user) return res.status(404).json({ error: "User not found" });
    
    if (user.balance >= price) {
        user.balance -= price;
        user.inventory.push(imageUrl);
        res.json({ success: true, balance: user.balance, inventory: user.inventory });
    } else {
        res.status(400).json({ error: "Insufficient funds" });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});