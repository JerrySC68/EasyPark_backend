const express = require('express');
const router = express.Router();
const { poolPromise } = require('../db');
const verificarToken = require('../authMiddleware');



router.get('/email/:email/password/:password', verificarToken, async (req, res) => {
  const { email, password } = req.params;

  try {
    const result = await sql.query`SELECT * FROM dbo.Usuarios WHERE email = ${email} AND password = ${password}`;

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado o contraseña incorrecta' });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Error al consultar usuario:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});


module.exports = router;