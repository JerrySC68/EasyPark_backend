const express = require('express');
const router = express.Router();
const { poolPromise } = require('../db');
const verificarToken = require('../authMiddleware');


router.post("/",verificarToken, async (req, res) => {
  const { usuario_id, estacionamiento_id, puntuacion, comentario, fecha } = req.body;

  try {
    const pool = await poolPromise;
    await pool.request()
      .input("usuario_id", usuario_id)
      .input("estacionamiento_id", estacionamiento_id)
      .input("puntuacion", puntuacion)
      .input("comentario", comentario)
      .input("fecha", fecha)
      .query(`
        INSERT INTO Comentarios (usuario_id, estacionamiento_id, puntuacion, comentario, fecha)
        VALUES (@usuario_id, @estacionamiento_id, @puntuacion, @comentario, @fecha)
      `);

    res.status(201).json({ mensaje: "Comentario guardado con éxito" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al guardar el comentario" });
  }
});

module.exports = router;
