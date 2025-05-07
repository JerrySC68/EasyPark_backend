const express = require('express');
const router = express.Router();
const { poolPromise } = require('../db');

// Ruta GET para listar usuarios
router.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM Usuarios'); //  nombre real de tu tabla
        res.json(result.recordset);
    } catch (err) {
        console.error('❌ Error al consultar usuarios:', err.message);
        res.status(500).json({ error: 'Error al obtener los usuarios' });
    }
});

module.exports = router;
