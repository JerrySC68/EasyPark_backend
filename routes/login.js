const express = require('express');
const router = express.Router();
const { poolPromise } = require('../db'); // Import poolPromise for DB connection
const verificarToken = require('../authMiddleware'); // Middleware for verifying token

router.post('/login', verificarToken, async (req, res) => {
  const { email, password } = req.body;

  try {
    // Get a pool connection from poolPromise
    const pool = await poolPromise;

    // Query the database using the pool connection
    const result = await pool.request()
      .input('email', email)
      .input('password', password)
      .query(`
        SELECT * FROM dbo.Usuarios 
        WHERE CAST(email AS NVARCHAR(MAX)) = @email 
        AND CAST(password AS NVARCHAR(MAX)) = @password
      `);

    // Check if user is found
    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado o contraseña incorrecta' });
    }

    // Return user data
    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Error al consultar usuario:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

module.exports = router;
