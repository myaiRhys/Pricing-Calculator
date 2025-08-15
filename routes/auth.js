const express = require('express');
const router = express.Router();

// Simple authentication for now - you can expand this later
// For production, consider implementing proper user management with bcrypt and JWT

// POST /api/auth/login - Simple login (placeholder)
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Simple hardcoded authentication for now
    // In production, check against database with proper password hashing
    const validUsers = {
      'admin': 'admin123',
      'rhys': 'pss2025',
      'manager': 'manager123'
    };
    
    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Username and password are required' 
      });
    }
    
    if (validUsers[username] && validUsers[username] === password) {
      // In production, generate proper JWT token
      const user = {
        username,
        role: username === 'admin' ? 'admin' : 'user',
        loginTime: new Date()
      };
      
      res.json({
        message: 'Login successful',
        user,
        token: `simple-token-${username}-${Date.now()}` // Placeholder token
      });
    } else {
      res.status(401).json({ 
        error: 'Invalid username or password' 
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/logout - Logout
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// GET /api/auth/me - Get current user info
router.get('/me', (req, res) => {
  // In production, verify JWT token and return user info
  res.json({
    user: {
      username: 'system',
      role: 'user',
      loginTime: new Date()
    }
  });
});

module.exports = router;