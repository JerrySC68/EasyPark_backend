const express = require('express');
const router = express.Router();
const { poolPromise } = require('../db');
const admin = require("../config/firebaseConfig");
const verificarToken = require('../authMiddleware');

router.get('/', verificarToken, async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT * FROM Usuarios');
    res.json(result.recordset);
  } catch (err) {
    console.error('❌ Error al consultar usuarios:', err.message);
    res.status(500).json({ error: 'Error al obtener los usuarios' });
  }
});

router.post("/registrar", async (req, res) => {
  const { nombre, email, password, tipo_usuarios, telefono } = req.body;

  try {
    // 1. Crear usuario en Firebase Auth
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: nombre,
    });

    const uid = userRecord.uid;

    // 2. Insertar en tu base de datos con UID de Firebase
    const pool = await poolPromise;
    await pool.request()
      .input("nombre", nombre)
      .input("email", email)
      .input("password", password) // opcional: no es necesario guardar password si ya está en Firebase
      .input("tipo_usuarios", tipo_usuarios)
      .input("telefono", telefono)
      .query(`INSERT INTO Usuarios ( nombre, email, password, tipo_usuarios, telefono, fecha_registro)
              VALUES (@uid, @nombre, @email, @password, @tipo_usuarios, @telefono, GETDATE())`);

    res.status(201).json({ mensaje: "Usuario registrado correctamente", uid });
  } catch (error) {
    console.error("❌ Error al registrar:", error.message);
    res.status(500).json({ error: "Error al registrar usuario", detalle: error.message });
  }
});



module.exports = router;
