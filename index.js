const express = require('express');
const axios = require('axios');
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

// Функція для отримання повних даних ліда з Facebook Graph API
async function getLeadDetails(leadgen_id) {
  const access_token = process.env.FB_ACCESS_TOKEN; // Задай у .env
  const url = `https://graph.facebook.com/v19.0/${leadgen_id}?access_token=${access_token}`;

  try {
    const response = await axios.get(url);
    const fields = response.data?.field_data || [];

    const lead = {};
    fields.forEach(field => {
      lead[field.name] = field.values?.[0] || '';
    });

    return lead;
  } catch (error) {
    console.error('Помилка отримання деталей ліда:', error.response?.data || error.message);
    return {};
  }
}

// Функція для додавання ліда у Google Таблицю
async function appendLead(data) {
  const spreadsheetId = '1P4KRWSR8U8_jevJ83PQGyoyXTnVQ4uF7lzv0LjxrWGY';
  const range = 'A:I'; // Колонки для запису

  const values = [
    [
      data.id || '',
      data.ad_id || '',
      data.form_id || '',
      data.page_id || '',
      data.created_time || '',
      data.name || '',
      data.phone || '',
      data.email || '',
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
  const VERIFY_TOKEN = "my_custom_token"; // Заміни на свій токен

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
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value || {};

    const fullLead = await getLeadDetails(value.leadgen_id);

    const leadData = {
      id: value.leadgen_id || '',
      ad_id: value.ad_id || '',
      form_id: value.form_id || '',
      page_id: value.page_id || '',
      created_time: value.created_time || '',
      name: fullLead.full_name || '',
      phone: fullLead.phone_number || '',
      email: fullLead.email || '',
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
