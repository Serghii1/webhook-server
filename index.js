require('dotenv').config();

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

const { google } = require('googleapis');
const path = require('path');

app.use(express.json());

// Ініціалізація Google Sheets API
const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, process.env.GOOGLE_APPLICATION_CREDENTIALS),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

const spreadsheetId = process.env.SPREADSHEET_ID;

// Функція для додавання ліда у Google Таблицю
async function appendLead(data) {
  const range = 'A:F'; // Стовпці для запису

  const values = [
    [
      data.id || '',
      data.ad_id || '',
      data.form_id || '',
      data.page_id || '',
      data.created_time || '',
      data.date || new Date().toISOString(),
    ],
  ];

  const resource = { values };

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      resource,
    });
    console.log('Лід додано в таблицю');
  } catch (err) {
    console.error('Помилка при додаванні ліда:', err);
  }
}

// GET /webhook для валідації від Facebook
app.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

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
  } else {
    res.sendStatus(400);
  }
});

// POST /webhook для прийому лідів від Facebook
app.post('/webhook', async (req, res) => {
  console.log('Отримано POST:', JSON.stringify(req.body, null, 2));

  try {
    const data = req.body.entry?.[0]?.changes?.[0]?.value || {};

    const leadData = {
      id: data.leadgen_id || '',
      ad_id: data.ad_id || '',
      form_id: data.form_id || '',
      page_id: data.page_id || '',
      created_time: data.created_time || '',
      date: new Date().toISOString(),
    };

    await appendLead(leadData);

    res.status(200).send('Отримано!');
  } catch (error) {
    console.error('Помилка обробки ліда:', error);
    res.sendStatus(500);
  }
});

// Проста перевірка сервера
app.get('/', (req, res) => {
  res.send('Webhook сервер працює');
});

app.listen(PORT, () => {
  console.log(`Сервер запущено на порту ${PORT}`);
});
