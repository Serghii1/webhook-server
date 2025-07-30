require('dotenv').config();
const axios = require('axios');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

const { google } = require('googleapis');
const path = require('path');

async function fetchLeadDetails(leadgen_id, access_token) {
  try {
    const response = await axios.get(`https://graph.facebook.com/v17.0/${leadgen_id}`, {
      params: { access_token }
    });
    return response.data;
  } catch (error) {
    console.error('Помилка отримання деталей ліда:', error.response?.data || error.message);
    return null;
  }
}

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
  const range = 'A:E'; // Стовпці для запису

  const values = [
    [
      data.id || '',
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
  console.log('--- Отримано POST-запит ---');
  console.log('Тіло запиту:', JSON.stringify(req.body, null, 2));

  try {
    const data = req.body;
    const leadgen_id = data.entry?.[0]?.changes?.[0]?.value?.leadgen_id;
    const form_id = data.entry?.[0]?.changes?.[0]?.value?.form_id;

    console.log('Витягнуто leadgen_id:', leadgen_id);
    console.log('Витягнуто form_id:', form_id);

    const pageAccessToken = process.env.PAGE_ACCESS_TOKEN;
    console.log('PAGE_ACCESS_TOKEN встановлено:', !!pageAccessToken);

    if (!leadgen_id) {
      console.log('Leadgen ID відсутній у запиті Facebook.');
      return res.status(400).send('Leadgen ID відсутній');
    }

    const leadDetails = await fetchLeadDetails(leadgen_id, pageAccessToken);

    if (!leadDetails) {
      console.log('Не вдалося отримати деталі ліда з Facebook Graph API.');
      return res.status(500).send('Не вдалося отримати деталі ліда');
    }

    console.log('Деталі ліда отримані:', leadDetails);

    const leadData = {
      id: leadDetails.id || '',
      name: '',
      phone: '',
      email: '',
      date: new Date().toISOString(),
    };

    // Facebook повертає дані ліда у форматі field_data: [{ name: 'field_name', values: ['value'] }]
    // Цей блок перебирає масив field_data та витягує потрібні поля
    if (leadDetails.field_data && Array.isArray(leadDetails.field_data)) {
        leadDetails.field_data.forEach(field => {
            if (field.name === 'full_name' && field.values && field.values.length > 0) {
                leadData.name = field.values[0];
            } else if (field.name === 'phone_number' && field.values && field.values.length > 0) {
                leadData.phone = field.values[0];
            } else if (field.name === 'email' && field.values && field.values.length > 0) {
                leadData.email = field.values[0];
            }
            // Додайте сюди інші поля, які ви збираєте у формі, за аналогією
        });
    }
    console.log('Дані ліда для таблиці:', leadData);


    await appendLead(leadData);

    res.status(200).send('Отримано!');
    console.log('--- Обробка ліда завершена успішно ---');
  } catch (error) {
    console.error('--- Помилка обробки ліда ---');
    console.error('Помилка:', error.message);
    if (error.response) {
        console.error('Дані відповіді помилки:', error.response.data);
        console.error('Статус відповіді помилки:', error.response.status);
    }
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