const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.post('/webhook', (req, res) => {
  console.log('Новий лід:', req.body);
  res.status(200).send('Отримано!');
});

app.get('/', (req, res) => {
  res.send('Webhook сервер працює');
});

app.listen(PORT, () => {
  console.log(`Сервер запущено на порту ${PORT}`);
});
