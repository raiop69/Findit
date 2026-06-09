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

// Helper to resolve current user role from the database
async function getUserRoleById(userId) {
  const pool = getPool();
  const result = await pool.request()
    .input('user_id', sql.Int, userId)
    .query('SELECT role FROM Admins WHERE user_id = @user_id');
  return result.recordset.length > 0 ? result.recordset[0].role : 'user';
}

async function requireAdmin(req, res, next) {
  const userId = parseInt(req.headers['x-user-id'] || req.body.user_id || req.query.userId, 10);
  if (!userId) {
    return res.status(401).json({ error: 'Admin user id is required' });
  }
  try {
    const role = await getUserRoleById(userId);
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Admin access only' });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

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
      .query(`SELECT u.user_id, u.password_hash, u.username, u.full_name, a.role
              FROM Users u
              LEFT JOIN Admins a ON u.user_id = a.user_id
              WHERE u.email = @email`);
    if (result.recordset.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const user = result.recordset[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({
      message: 'Login successful',
      userId: user.user_id,
      email,
      name: user.full_name || user.username,
      role: user.role || 'user'
    });
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
app.get('/api/claims', requireAdmin, async (req, res) => {
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
app.put('/api/claims/:claimId', requireAdmin, async (req, res) => {
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

// Get claims for a specific user
app.get('/api/users/:userId/claims', async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  const requesterId = parseInt(req.headers['x-user-id'] || req.body.user_id || req.query.userId, 10);
  if (!requesterId) {
    return res.status(401).json({ error: 'User id is required' });
  }

  try {
    if (requesterId !== userId) {
      const role = await getUserRoleById(requesterId);
      if (role !== 'admin') {
        return res.status(403).json({ error: 'Not authorized' });
      }
    }

    const pool = getPool();
    const result = await pool.request()
      .input('user_id', sql.Int, userId)
      .query(`SELECT c.*, u.username AS claimant_username, fi.item_name
              FROM Claims c
              JOIN Users u ON c.claimant_user_id = u.user_id
              JOIN Found_Items fi ON c.found_item_id = fi.item_id
              WHERE c.claimant_user_id = @user_id
              ORDER BY c.submitted_at DESC`);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Found Item (owner or admin)
app.delete('/api/found-items/:itemId', async (req, res) => {
  const itemId = parseInt(req.params.itemId, 10);
  const userId = parseInt(req.headers['x-user-id'] || req.body.user_id, 10);
  if (!userId) return res.status(401).json({ error: 'User id required' });
  try {
    const pool = getPool();
    const itemRes = await pool.request()
      .input('item_id', sql.Int, itemId)
      .query('SELECT user_id FROM Found_Items WHERE item_id = @item_id');
    if (itemRes.recordset.length === 0) return res.status(404).json({ error: 'Item not found' });
    const ownerId = itemRes.recordset[0].user_id;
    if (ownerId !== userId) {
      const role = await getUserRoleById(userId);
      if (role !== 'admin') return res.status(403).json({ error: 'Not authorized to delete this item' });
    }
    await pool.request()
      .input('item_id', sql.Int, itemId)
      .query('DELETE FROM Found_Items WHERE item_id = @item_id');
    res.json({ message: 'Found item deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Lost Item (owner or admin)
app.delete('/api/lost-items/:itemId', async (req, res) => {
  const itemId = parseInt(req.params.itemId, 10);
  const userId = parseInt(req.headers['x-user-id'] || req.body.user_id, 10);
  if (!userId) return res.status(401).json({ error: 'User id required' });
  try {
    const pool = getPool();
    const itemRes = await pool.request()
      .input('item_id', sql.Int, itemId)
      .query('SELECT user_id FROM Lost_Items WHERE item_id = @item_id');
    if (itemRes.recordset.length === 0) return res.status(404).json({ error: 'Item not found' });
    const ownerId = itemRes.recordset[0].user_id;
    if (ownerId !== userId) {
      const role = await getUserRoleById(userId);
      if (role !== 'admin') return res.status(403).json({ error: 'Not authorized to delete this item' });
    }
    await pool.request()
      .input('item_id', sql.Int, itemId)
      .query('DELETE FROM Lost_Items WHERE item_id = @item_id');
    res.json({ message: 'Lost item deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve static files from the parent directory (frontend)
app.use(express.static(path.join(__dirname, '..')));

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