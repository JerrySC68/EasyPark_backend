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


router.post('/reservas', verificarToken, async (req, res) => {
  try {
    const {
      usuario_id,
      estacionamiento_id,
      garaje_id,
      qr_code,
      estado,
      fecha_reserva,
      hora_reserva,
      penalizacion
    } = req.body;

    // Validación: solo uno de los dos debe existir
    if ((estacionamiento_id && garaje_id) || (!estacionamiento_id && !garaje_id)) {
      return res.status(400).json({ error: "Debe enviar solo estacionamiento_id o garaje_id, no ambos." });
    }

    const tipo = estacionamiento_id ? "Estacionamiento" : "Garaje";
    const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const finalQrCode = `${qr_code}-${uniqueSuffix}`;
    const pool = await poolPromise;
    const request = pool.request();

    request.input("usuario_id", usuario_id);
    request.input("estacionamiento_id", estacionamiento_id ?? null);
    request.input("garaje_id", garaje_id ?? null);
    request.input("qr_code", finalQrCode);
    request.input("estado", estado);
    request.input("fecha_reserva", fecha_reserva);
    request.input("hora_reserva", hora_reserva);
    request.input("penalizacion", penalizacion);

    await request.query(`
      INSERT INTO Reservas (
        usuario_id, estacionamiento_id, garaje_id,
        qr_code, estado, fecha_reserva, hora_reserva, penalizacion
      )
      VALUES (
        @usuario_id, @estacionamiento_id, @garaje_id,
        @qr_code, @estado, @fecha_reserva, @hora_reserva, @penalizacion
      )
    `);

    // Retornar los datos que necesitas
    res.status(201).json({
      mensaje: "Reserva creada correctamente",
      qr_code,
      estado,
      penalizacion,
      tipo
    });

  } catch (error) {
    console.error("❌ Error al insertar reserva:", error);
    res.status(500).json({ error: "Error al crear la reserva" });
  }
});


router.get("/pendientes-aceptadas", verificarToken, async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT r.idReserva, r.qr_code, r.estado,
             COALESCE(e.latitud, g.latitud) AS latitud,
             COALESCE(e.longitud, g.longitud) AS longitud,
             CASE 
               WHEN r.estacionamiento_id IS NOT NULL THEN 'estacionamiento'
               ELSE 'garaje'
             END AS tipo,
             COALESCE(e.direccion, g.direccion) AS direccion
      FROM Reservas r
      LEFT JOIN Estacionamientos e ON r.estacionamiento_id = e.idEstacionamiento
      LEFT JOIN GarajesPrivados g ON r.garaje_id = g.idGaraje
      WHERE r.estado IN ('pendiente', 'confirmada')
        AND (
          (r.estacionamiento_id IS NOT NULL AND r.garaje_id IS NULL) OR
          (r.estacionamiento_id IS NULL AND r.garaje_id IS NOT NULL)
        )
    `);
    res.json(result.recordset);
  } catch (error) {
    console.error("Error obteniendo reservas:", error);
    res.status(500).json({ error: "Error al obtener reservas" });
  }
});


router.put("/cancelar/:id", verificarToken, async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    await pool.request()
      .input("id", id)
      .query("UPDATE Reservas SET estado = 'cancelada' WHERE idReserva = @id");
    res.json({ mensaje: "Reserva cancelada" });
  } catch (error) {
    console.error("Error cancelando reserva:", error);
    res.status(500).json({ error: "Error al cancelar la reserva" });
  }
});

router.get("/pendientes/:id", verificarToken, async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input("propietarioId", id)
      .query(`
        SELECT 
          r.idReserva,
          COALESCE(e.latitud, g.latitud) AS latitud,
          COALESCE(e.longitud, g.longitud) AS longitud,
          CASE 
            WHEN r.estacionamiento_id IS NOT NULL THEN 'estacionamiento'
            ELSE 'garaje'
          END AS tipo,
          COALESCE(e.direccion, g.direccion) AS direccion
        FROM Reservas r
        LEFT JOIN Estacionamientos e ON r.estacionamiento_id = e.idEstacionamiento
        LEFT JOIN GarajesPrivados g ON r.garaje_id = g.idGaraje
        WHERE r.estado = 'pendiente'
          AND (
            (r.estacionamiento_id IS NOT NULL AND g.idGaraje IS NULL AND e.idPropietario = @propietarioId)
            OR
            (r.garaje_id IS NOT NULL AND e.idEstacionamiento IS NULL AND g.dueno_id = @propietarioId)
          )
      `);

    res.json(result.recordset);
  } catch (error) {
    console.error("Error trayendo reservas pendientes:", error);
    res.status(500).json({ error: "Error trayendo reservas pendientes" });
  }
});


router.put("/aceptar/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    await pool.request()
      .input("id", id)
      .query("UPDATE Reservas SET estado = 'confirmada' WHERE idReserva = @id");
    res.json({ mensaje: "Reserva aceptada" });
  } catch (error) {
    console.error("Error aceptando reserva:", error);
    res.status(500).json({ error: "Error al aceptar la reserva" });
  }
});
router.get("/pendientes/count",verificarToken, async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query("SELECT COUNT(*) AS total FROM Reservas WHERE estado = 'pendiente'");
    res.json(result.recordset[0]);
  } catch (error) {
    console.error("Error contando reservas pendientes:", error);
    res.status(500).json({ error: "Error contando reservas" });
  }
});
router.get("/usuario/:id/pendientes",verificarToken, async (req, res) => {
  const { uid } = req.params;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input("uid", uid)
      .query(`SELECT COUNT(*) AS total FROM Reservas WHERE usuario_id = @uid AND estado IN ('pendiente', 'aceptado')`);
    res.json(result.recordset[0]);
  } catch (error) {
    console.error("Error contando reservas:", error);
    res.status(500).json({ error: "Error al contar reservas" });
  }
});

router.post("/pendientes-confirmadas", verificarToken, async (req, res) => {
  try {
    const pool = await poolPromise;
    const propietarioId = req.body.propietarioId;

    if (!propietarioId) {
      return res.status(400).json({ error: "Falta el propietarioId en el cuerpo de la solicitud" });
    }

    const pendientes = await pool.request()
      .input("propietarioId", propietarioId)
      .query(`
        SELECT r.*, 
               COALESCE(e.direccion, g.direccion) AS direccion,
               COALESCE(e.latitud, g.latitud) AS latitud,
               COALESCE(e.longitud, g.longitud) AS longitud,
               u.nombre AS nombreUsuario,
               CASE 
                 WHEN r.estacionamiento_id IS NOT NULL THEN 'estacionamiento'
                 ELSE 'garaje'
               END AS tipo
        FROM Reservas r
        LEFT JOIN Estacionamientos e ON r.estacionamiento_id = e.idEstacionamiento
        LEFT JOIN GarajesPrivados g ON r.garaje_id = g.idGaraje
        JOIN Usuarios u ON r.usuario_id = u.idUsuario
        WHERE r.estado = 'pendiente'
          AND (
            (r.estacionamiento_id IS NOT NULL AND e.idPropietario = @propietarioId)
            OR 
            (r.garaje_id IS NOT NULL AND g.dueno_id = @propietarioId)
          )
      `);

    const confirmadas = await pool.request()
      .input("propietarioId", propietarioId)
      .query(`
        SELECT r.*, 
               COALESCE(e.direccion, g.direccion) AS direccion,
               COALESCE(e.latitud, g.latitud) AS latitud,
               COALESCE(e.longitud, g.longitud) AS longitud,
               u.nombre AS nombreUsuario,
               CASE 
                 WHEN r.estacionamiento_id IS NOT NULL THEN 'estacionamiento'
                 ELSE 'garaje'
               END AS tipo
        FROM Reservas r
        LEFT JOIN Estacionamientos e ON r.estacionamiento_id = e.idEstacionamiento
        LEFT JOIN GarajesPrivados g ON r.garaje_id = g.idGaraje
        JOIN Usuarios u ON r.usuario_id = u.idUsuario
        WHERE r.estado = 'confirmada'
          AND (
            (r.estacionamiento_id IS NOT NULL AND e.idPropietario = @propietarioId)
            OR 
            (r.garaje_id IS NOT NULL AND g.dueno_id = @propietarioId)
          )
      `);

    res.json({
      pendientes: pendientes.recordset,
      confirmadas: confirmadas.recordset
    });

  } catch (error) {
    console.error("Error obteniendo reservas:", error);
    res.status(500).json({ error: "Error al obtener reservas" });
  }
});



router.put("/reservas/cancelar/:id", verificarToken, async (req, res) => {
  const { motivo } = req.body;
  const idReserva = req.params.id;

  try {
    const pool = await poolPromise;

    const result = await pool.request()
      .input("idReserva", idReserva)
      .query(`SELECT * FROM Reservas WHERE idReserva = @idReserva`);

    const reserva = result.recordset[0];
    if (!reserva) return res.status(404).json({ error: "Reserva no encontrada" });

    // 1. Insertar penalización
    await pool.request()
      .input("usuario_id", reserva.usuario_id)
      .input("estacionamiento_id", reserva.estacionamiento_id)
      .input("motivo", motivo)
      .query(`
        INSERT INTO Penalizacion (usuario_id, estacionamiento_id, motivo, fecha)
        VALUES (@usuario_id, @estacionamiento_id, @motivo, GETDATE())
      `);

    // 2. Actualizar estado de la reserva
    await pool.request()
      .input("idReserva", idReserva)
      .query(`UPDATE Reservas SET estado = 'cancelada' WHERE idReserva = @idReserva`);

    // 3. Insertar en HistorialReservas
    await pool.request()
      .input("id_reserva", reserva.idReserva)
      .input("usuario_id", reserva.usuario_id)
      .input("estacionamiento_id", reserva.estacionamiento_id)
      .input("fecha_reserva", reserva.fecha_reserva)
      .input("estado", 'cancelada')
      .query(`
        INSERT INTO HistorialReservas (id_reserva, usuario_id, estacionamiento_id, fecha_reserva, estado)
        VALUES (@id_reserva, @usuario_id, @estacionamiento_id, @fecha_reserva, @estado)
      `);

    res.json({ mensaje: "Reserva cancelada, penalización e historial registrados" });
  } catch (err) {
    console.error("Error cancelando reserva:", err);
    res.status(500).json({ error: "Error al cancelar la reserva." });
  }
});

router.post("/reservas/completar", verificarToken, async (req, res) => {
  const { qr_code, idReserva } = req.body;

  if (!qr_code && !idReserva) {
    return res.status(400).json({ error: "Debe enviar qr_code o idReserva" });
  }

  try {
    const pool = await poolPromise;
    let result;

    // Buscar reserva original
    if (qr_code ) {
      result = await pool.request()
        .input("qr", qr_code)
        .input("idReserva", idReserva)
        .query("SELECT * FROM Reservas WHERE CAST(qr_code AS NVARCHAR(MAX)) = @qr");
    } else if (idReserva) {
      result = await pool.request()
        .input("idReserva", idReserva)
        .query("SELECT * FROM Reservas WHERE idReserva = @idReserva");
    }


    const reserva = result.recordset[0];

    if (!reserva) {
      return res.status(404).json({ error: "Reserva no encontrada" });
    }

    if (reserva.estado === "completada") {
      return res.status(400).json({ error: "La reserva ya está completada" });
    }

    // Actualizar estado a 'completada'
    await pool.request()
      .input("id", reserva.idReserva)
      .query("UPDATE Reservas SET estado = 'completada' WHERE idReserva = @id");

    // Insertar en HistorialReservas
    await pool.request()
      .input("id_reserva", reserva.idReserva)
      .input("usuario_id", reserva.usuario_id)
      .input("estacionamiento_id", reserva.estacionamiento_id)
      .input("fecha_reserva", reserva.fecha_reserva)
      .input("estado", 'completada')
      .query(`
        INSERT INTO HistorialReservas (id_reserva, usuario_id, estacionamiento_id, fecha_reserva, estado)
        VALUES (@id_reserva, @usuario_id, @estacionamiento_id, @fecha_reserva, @estado)
      `);

    return res.status(200).json({ message: "Reserva completada y registrada en historial" });
  } catch (err) {
    console.error("Error al completar reserva:", err);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});


router.put("/reservas/cancelar/:id", verificarToken, async (req, res) => {
  const { motivo } = req.body;
  const idReserva = req.params.id;

  try {
    const pool = await poolPromise;

    const result = await pool.request()
      .input("idReserva", idReserva)
      .query(`SELECT * FROM Reservas WHERE idReserva = @idReserva`);

    const reserva = result.recordset[0];
    if (!reserva) return res.status(404).json({ error: "Reserva no encontrada" });

    // 1. Insertar en tabla Penalizacion
    await pool.request()
      .input("usuario_id", reserva.usuario_id)
      .input("estacionamiento_id", reserva.estacionamiento_id)
      .input("motivo", motivo)
      .query(`
        INSERT INTO Penalizacion (usuario_id, estacionamiento_id, motivo, fecha)
        VALUES (@usuario_id, @estacionamiento_id, @motivo, GETDATE())
      `);

    // 2. Marcar reserva como cancelada
    await pool.request()
      .input("idReserva", idReserva)
      .query(`UPDATE Reservas SET estado = 'cancelada' WHERE idReserva = @idReserva`);

    res.json({ mensaje: "Reserva cancelada y penalización registrada" });
  } catch (err) {
    console.error("Error cancelando reserva:", err);
    res.status(500).json({ error: "Error al cancelar la reserva." });
  }
});


module.exports = router;



