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

// GET /api/propiedades/campos/:tipo/:id

router.put('/campos/:tipo/:id', verificarToken, async (req, res) => {
  const { tipo, id } = req.params;
  const { camposLibres, estado } = req.body; // ⬅️ agregamos estado aquí

  if (camposLibres < 0) {
    return res.status(400).json({ error: "camposLibres no puede ser negativo." });
  }

  try {
    const tabla = tipo === 'Garaje' ? 'GarajesPrivados' : 'Estacionamientos';
    const campoId = tipo === 'Garaje' ? 'idGaraje' : 'idEstacionamiento';

    const pool = await poolPromise;

    const request = pool.request()
      .input('id', parseInt(id))
      .input('camposLibres', camposLibres);

    let query = '';

    if (tipo === 'Garaje') {
      request.input('estado', estado); // ⬅️ se añade el parámetro
      query = `
        UPDATE ${tabla}
        SET camposLibres = @camposLibres,
            estado = @estado
        WHERE ${campoId} = @id
      `;
    } else {
      query = `
        UPDATE ${tabla}
        SET camposLibres = @camposLibres
        WHERE ${campoId} = @id
      `;
    }

    await request.query(query);

    res.json({ mensaje: "Campos libres actualizados correctamente." });
  } catch (err) {
    console.error("❌ Error al actualizar campos libres:", err);
    res.status(500).json({ error: "Error del servidor al actualizar campos libres." });
  }
});

// DELETE /api/propiedades/eliminar/:tipo/:id
router.delete('/eliminar/:tipo/:id', verificarToken, async (req, res) => {
  const { tipo, id } = req.params;
  const propiedadId = parseInt(id);

  const isGaraje = tipo === 'Garaje';
  const tablaPropiedad = isGaraje ? 'GarajesPrivados' : 'Estacionamientos';
  const tablaTarifas = isGaraje ? 'TarifasGaraje' : 'TarifasEstacionamiento';
  const campoId = isGaraje ? 'idGaraje' : 'idEstacionamiento';

  try {
    const pool = await poolPromise;

    // Eliminar tarifas asociadas
    await pool.request()
      .input(campoId, propiedadId)
      .query(`DELETE FROM ${tablaTarifas} WHERE ${campoId} = @${campoId}`);

    // Eliminar la propiedad
    await pool.request()
      .input('id', propiedadId)
      .query(`DELETE FROM ${tablaPropiedad} WHERE ${campoId} = @id`);

    res.json({ mensaje: `${tipo} y sus tarifas eliminados correctamente.` });
  } catch (err) {
    console.error(`❌ Error al eliminar ${tipo.toLowerCase()}:`, err);
    res.status(500).json({ error: `Error al eliminar ${tipo.toLowerCase()}.` });
  }
});


router.get('/cercanas', verificarToken, async (req, res) => {
  try {
    const pool = await poolPromise; 

    const estacionamientos = await pool.request()
      .query(`
        SELECT 
          idEstacionamiento AS id,
          nombre,
          latitud,
          longitud,
          'Estacionamiento' AS tipo,
          direccion,
          horario,
          anchura,
          altura,
          camposlibres
        FROM Estacionamientos
        WHERE camposlibres > 0

      `);

    const garajes = await pool.request()
      .query(`
        SELECT 
          idGaraje AS id,
          latitud,
          longitud,
          'Garaje' AS tipo,
          direccion,
          horario,
          anchura,
          altura,
          camposlibres
        FROM GarajesPrivados
        WHERE estado = 'disponible' AND camposlibres > 0

      `);

    const propiedades = [...estacionamientos.recordset, ...garajes.recordset];
    res.json(propiedades);
  } catch (err) {
    console.error("❌ Error al consultar propiedades cercanas:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

module.exports = router;



