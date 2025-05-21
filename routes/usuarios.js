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
// GET /api/usuarios/:id
router.get('/:id', verificarToken, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('idUsuario', id)
      .query(`SELECT idUsuario, nombre, email, password, telefono FROM Usuarios WHERE idUsuario = @idUsuario`);

    if (result.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    res.json(result.recordset[0]);
  } catch (err) {
    console.error("❌ Error al obtener usuario:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});
// PUT /api/usuarios/editar/:id
router.put('/editar/:id', verificarToken, async (req, res) => {
  const id = parseInt(req.params.id);
  

  const { nombre, email, password, telefono, uid } = req.body;

if (!uid || !nombre || !email || !password || !telefono) {
  return res.status(400).json({ error: "Faltan datos obligatorios." });
}

// 🔐 1. Actualizar en Firebase
await admin.auth().updateUser(uid, {
  email,
  password,
  displayName: nombre
});


  try {
    const pool = await poolPromise;
    await pool.request()
      .input('idUsuario', id)
      .input('nombre', nombre)
      .input('email', email)
      .input('password', password)
      .input('telefono', telefono)
      .query(`
        UPDATE Usuarios 
        SET nombre = @nombre, email = @email, password = @password, telefono = @telefono 
        WHERE idUsuario = @idUsuario
      `);

    res.json({ mensaje: "Usuario actualizado correctamente" });
  } catch (err) {
    console.error("❌ Error al actualizar usuario:", err);
    res.status(500).json({ error: "Error interno del servidor" });
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
    const result=await pool.request()
      .input("nombre", nombre)
      .input("email", email)
      .input("password", password) // opcional: no es necesario guardar password si ya está en Firebase
      .input("tipo_usuarios", tipo_usuarios)
      .input("telefono", telefono)
      .query(`INSERT INTO Usuarios ( nombre, email, password, tipo_usuarios, telefono, fecha_registro)
              VALUES ( @nombre, @email, @password, @tipo_usuarios, @telefono, GETDATE())`);
    
    res.status(201).json({ mensaje: 'Usuario registrado con éxito', User:result.recordset[0]});
  
  } catch (error) {
    console.error("❌ Error al registrar:", error.message);
    res.status(500).json({ error: "Error al registrar usuario", detalle: error.message });
  }
});
router.get('/pendientes', verificarToken, async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query(`SELECT * FROM Usuarios WHERE tipo_usuarios IN ( 'propietariop')`);
    
    res.json(result.recordset);
  } catch (err) {
    console.error('❌ Error al obtener administradores o propietarios:', err.message);
    res.status(500).json({ error: 'Error al obtener usuarios filtrados' });
  }
});
// Editar el tipo_usuarios de un usuario
router.put('/:id/tipo', verificarToken, async (req, res) => {
  const { id } = req.params;
  const { tipo_usuarios } = req.body;

  if (!tipo_usuarios) {
    return res.status(400).json({ error: 'El nuevo tipo_usuarios es requerido.' });
  }

  try {
    const pool = await poolPromise;
    await pool.request()
      .input('tipo_usuarios', tipo_usuarios)
      .input('idUsuario', id)
      .query('UPDATE Usuarios SET tipo_usuarios = @tipo_usuarios WHERE idUsuario = @idUsuario');

    res.json({ mensaje: 'Tipo de usuario actualizado correctamente.' });
  } catch (err) {
    console.error('❌ Error al actualizar tipo de usuario:', err.message);
    res.status(500).json({ error: 'Error al actualizar el tipo de usuario.' });
  }
});



module.exports = router;
