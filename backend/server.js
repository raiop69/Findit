const express = require('express');
const cors = require('cors');
const path = require('path');
const { initConnection, getPool, sql } = require('./db');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Middleware to check database connection
app.use((req, res, next) => {
  try {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not ready' });
    }
    next();
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }
});

// Serve static files from the parent directory (frontend)
app.use(express.static(path.join(__dirname, '..')));

// API routes
app.get('/api', (req, res) => {
  res.send('FindIt Backend API is running');
});

// User Signup
app.post('/api/users/signup', async (req, res) => {
  const { username, email, password, phone, full_name } = req.body;
  try {
    const pool = getPool();
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.request()
      .input('username', sql.NVarChar(50), username)
      .input('email', sql.NVarChar(100), email)
      .input('password_hash', sql.NVarChar(255), hashedPassword)
      .input('phone', sql.NVarChar(20), phone || null)
      .input('full_name', sql.NVarChar(100), full_name)
      .query('INSERT INTO Users (username, email, password_hash, phone, full_name) OUTPUT INSERTED.user_id VALUES (@username, @email, @password_hash, @phone, @full_name)');
    res.status(201).json({ message: 'User created', userId: result.recordset[0].user_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// User Login
app.post('/api/users/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const pool = getPool();
    const result = await pool.request()
      .input('email', sql.NVarChar(100), email)
      .query('SELECT user_id, password_hash FROM Users WHERE email = @email');
    if (result.recordset.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const user = result.recordset[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ message: 'Login successful', userId: user.user_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Report Lost Item
app.post('/api/lost-items', async (req, res) => {
  const { user_id, item_name, description, location, date_lost, contact_info, image_url } = req.body;
  try {
    const pool = getPool();
    const result = await pool.request()
      .input('user_id', sql.Int, user_id)
      .input('item_name', sql.NVarChar(100), item_name)
      .input('description', sql.NVarChar(500), description || null)
      .input('location', sql.NVarChar(200), location || null)
      .input('date_lost', sql.Date, date_lost || null)
      .input('contact_info', sql.NVarChar(200), contact_info || null)
      .input('image_url', sql.NVarChar(500), image_url || null)
      .query('INSERT INTO Lost_Items (user_id, item_name, description, location, date_lost, contact_info, image_url) OUTPUT INSERTED.item_id VALUES (@user_id, @item_name, @description, @location, @date_lost, @contact_info, @image_url)');
    res.status(201).json({ message: 'Lost item reported', itemId: result.recordset[0].item_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get All Lost Items
app.get('/api/lost-items', async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request()
      .query('SELECT * FROM Lost_Items ORDER BY created_at DESC');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get User's Lost Items
app.get('/api/users/:userId/lost-items', async (req, res) => {
  const { userId } = req.params;
  try {
    const pool = getPool();
    const result = await pool.request()
      .input('user_id', sql.Int, userId)
      .query('SELECT * FROM Lost_Items WHERE user_id = @user_id ORDER BY created_at DESC');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Report Found Item
app.post('/api/found-items', async (req, res) => {
  const { user_id, item_name, description, location, date_found, contact_info, image_url } = req.body;
  try {
    const pool = getPool();
    const result = await pool.request()
      .input('user_id', sql.Int, user_id)
      .input('item_name', sql.NVarChar(100), item_name)
      .input('description', sql.NVarChar(500), description || null)
      .input('location', sql.NVarChar(200), location || null)
      .input('date_found', sql.Date, date_found || null)
      .input('contact_info', sql.NVarChar(200), contact_info || null)
      .input('image_url', sql.NVarChar(500), image_url || null)
      .query('INSERT INTO Found_Items (user_id, item_name, description, location, date_found, contact_info, image_url) OUTPUT INSERTED.item_id VALUES (@user_id, @item_name, @description, @location, @date_found, @contact_info, @image_url)');
    res.status(201).json({ message: 'Found item reported', itemId: result.recordset[0].item_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get All Found Items
app.get('/api/found-items', async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request()
      .query('SELECT * FROM Found_Items ORDER BY created_at DESC');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get User's Found Items
app.get('/api/users/:userId/found-items', async (req, res) => {
  const { userId } = req.params;
  try {
    const pool = getPool();
    const result = await pool.request()
      .input('user_id', sql.Int, userId)
      .query('SELECT * FROM Found_Items WHERE user_id = @user_id ORDER BY created_at DESC');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit Claim
app.post('/api/claims', async (req, res) => {
  const { found_item_id, claimant_user_id, claim_description, proof_details } = req.body;
  try {
    const pool = getPool();
    const result = await pool.request()
      .input('found_item_id', sql.Int, found_item_id)
      .input('claimant_user_id', sql.Int, claimant_user_id)
      .input('claim_description', sql.NVarChar(500), claim_description || null)
      .input('proof_details', sql.NVarChar(500), proof_details || null)
      .query('INSERT INTO Claims (found_item_id, claimant_user_id, claim_description, proof_details) OUTPUT INSERTED.claim_id VALUES (@found_item_id, @claimant_user_id, @claim_description, @proof_details)');
    res.status(201).json({ message: 'Claim submitted', claimId: result.recordset[0].claim_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get All Claims (for admin)
app.get('/api/claims', async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request()
      .query(`SELECT c.*, u.username AS claimant_username, fi.item_name
              FROM Claims c
              JOIN Users u ON c.claimant_user_id = u.user_id
              JOIN Found_Items fi ON c.found_item_id = fi.item_id
              ORDER BY c.submitted_at DESC`);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Claim Status (for admin)
app.put('/api/claims/:claimId', async (req, res) => {
  const { claimId } = req.params;
  const { status } = req.body;
  try {
    const pool = getPool();
    await pool.request()
      .input('claim_id', sql.Int, claimId)
      .input('status', sql.NVarChar(20), status)
      .query('UPDATE Claims SET status = @status, reviewed_at = GETDATE() WHERE claim_id = @claim_id');
    res.json({ message: 'Claim status updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Server
async function startServer() {
  try {
    await initConnection();
    console.log('Database ready');
    
    app.listen(PORT, () => {
      console.log(`✓ Server is running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

startServer();