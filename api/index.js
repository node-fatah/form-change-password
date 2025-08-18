const express = require('express');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const serverless = require('serverless-http');

const app = express();
const PORT = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');

// Google Sheets config
const SPREADSHEET_ID = '1S8oHwZ839_cfFq1o1dK82HW9fCScntawCqX1zXPy15k';
const SHEET_NAME = 'Dropdown';

const auth = new google.auth.GoogleAuth({
  credentials: {
    type: 'service_account',
    project_id: process.env.GOOGLE_PROJECT_ID,
    private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    client_id: process.env.GOOGLE_CLIENT_ID,
    auth_uri: process.env.GOOGLE_AUTH_URI,
    token_uri: process.env.GOOGLE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.GOOGLE_CLIENT_X509_CERT_URL,
  },
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
  ]
});

const sheets = google.sheets({ version: 'v4', auth });

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

// Render form
app.get('/', async (req, res) => {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!L:N`,
    });

    const rows = response.data.values || [];
    const users = rows.slice(1).map(row => ({
      email: row[0],
      password: row[1],
      name: row[2],
    }));

    res.render('form', { users, message: null });
  } catch (err) {
    console.error(err);
    res.send('Error fetching users');
  }
});

// Update password / Login
app.post('/update', async (req, res) => {
  const { email, oldPassword, newPassword, action } = req.body;

  if (action === 'login') {
    // Tombol Login diklik → langsung redirect
    return res.redirect('https://form-productivity-collection.vercel.app/login');
  }

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!L:M`,
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === email);

    if (rowIndex === -1) return res.send('User not found');

    const storedPassword = rows[rowIndex][1] || '';

    if (oldPassword !== storedPassword) {
      // Password lama tidak cocok
      const usersResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!L:N`,
      });

      const allRows = usersResponse.data.values || [];
      const users = allRows.slice(1).map(row => ({
        email: row[0],
        password: row[1],
        name: row[2],
      }));

      return res.render('form', { users, message: 'Password lama tidak cocok!' });
    }

// Validasi password baru
// Password harus minimal 6 karakter, ada huruf, angka, dan simbol
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{6,}$/;

if (!passwordRegex.test(newPassword)) {
  const usersResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!L:N`,
  });

  const allRows = usersResponse.data.values || [];
  const users = allRows.slice(1).map(row => ({
    email: row[0],
    password: row[1],
    name: row[2],
  }));

  return res.render('form', {
    users,
    message: 'Password baru harus minimal 6 karakter, mengandung huruf, angka, dan simbol!',
  });
}



    // Update password baru (plaintext)
    const updateRange = `${SHEET_NAME}!M${rowIndex + 1}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: updateRange,
      valueInputOption: 'RAW',
      requestBody: { values: [[newPassword]] },
    });

    // Tampilkan alert sukses di form
    const usersResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!L:N`,
    });
    const allRows = usersResponse.data.values || [];
    const users = allRows.slice(1).map(row => ({
      email: row[0],
      password: row[1],
      name: row[2],
    }));

    return res.render('form', { users, message: 'Password berhasil diubah! Klik Login untuk masuk.' });
  } catch (err) {
    console.error(err);
    res.send('Error updating password');
  }
});

module.exports = app;
module.exports.handler = serverless(app)
