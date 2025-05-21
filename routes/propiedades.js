const express = require('express');
const router = express.Router();
const { poolPromise } = require('../db');
const verificarToken = require('../authMiddleware');

// GET /api/propiedades/mis
router.get('/mis/:id',  verificarToken, async (req, res) => {
 const id = parseInt(req.params.id);

  try {
    const pool = await poolPromise;

    const garajes = await pool.request()
      .input('dueno_id',  id)
      .query(`SELECT dueno_id AS idpro,idGaraje AS id,'Garaje' AS tipo, direccion, disponibilidad FROM GarajesPrivados WHERE dueno_id = @dueno_id`);

    const estacionamientos = await pool.request()
      .input('idPropietario', id)
      .query(`SELECT idPropietario  AS idpro, idEstacionamiento AS id,'Estacionamiento' AS tipo,direccion, disponibilidad FROM Estacionamientos WHERE idPropietario = @idPropietario`);

    const propiedades = [...garajes.recordset, ...estacionamientos.recordset];

    res.json(propiedades);
  } catch (err) {
    console.error("❌ Error al listar propiedades:", err);
    res.status(500).json({ error: "No se pudieron cargar las propiedades" });
  }
});

module.exports = router;
