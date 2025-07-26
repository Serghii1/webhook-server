const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ➕ Додаємо GET /webhook для перевірки
app.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = "my_custom_token"; // заміни на свій токен

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

// POST — для прийому подій
app.post('/webhook', (req, res) => {
  console.log('Новий лід:', req.body);
  res.status(200).send('Отримано!');
});

// Просто перевірка кореневого URL
app.get('/', (req, res) => {
  res.send('Webhook сервер працює');
});

app.listen(PORT, () => {
  console.log(`Сервер запущено на порту ${PORT}`);
});
