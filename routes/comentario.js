const express = require('express');
const router = express.Router();
const { poolPromise } = require('../db');
const verificarToken = require('../authMiddleware');


router.post("/", verificarToken, async (req, res) => {
  const { usuario_id, estacionamiento_id, garaje_id, puntuacion, comentario, fecha } = req.body;

  // Validación: solo uno de los dos debe estar presente
  if ((estacionamiento_id && garaje_id) || (!estacionamiento_id && !garaje_id)) {
    return res.status(400).json({
      error: "Debe proporcionar solo uno: estacionamiento_id o garaje_id",
    });
  }

  try {
    const pool = await poolPromise;

    await pool.request()
      .input("usuario_id", usuario_id)
      .input("estacionamiento_id", estacionamiento_id || null)
      .input("garaje_id", garaje_id || null)
      .input("puntuacion", puntuacion)
      .input("comentario", comentario)
      .input("fecha", fecha)
      .query(`
        INSERT INTO Calificaciones (usuario_id, estacionamiento_id, garaje_id, puntuacion, comentario, fecha)
        VALUES (@usuario_id, @estacionamiento_id, @garaje_id, @puntuacion, @comentario, @fecha)
      `);

    res.status(201).json({ mensaje: "Comentario guardado con éxito" });
  } catch (err) {
    console.error("Error al guardar comentario:", err);
    res.status(500).json({ error: "Error al guardar el comentario" });
  }
});


router.get("/estacionamientos", verificarToken, async (req, res) => {
  const { nombre } = req.query;

  try {
    const pool = await poolPromise;

    const estacionamientos = await pool.request()
      .input("nombre", `%${nombre}%`)
      .query(`
        SELECT idEstacionamiento AS id, nombre, direccion, latitud, longitud, 'estacionamiento' AS tipo
        FROM Estacionamientos
        WHERE nombre LIKE @nombre
      `);

    const garajes = await pool.request()
      .input("nombre", `%${nombre}%`)
      .query(`
        SELECT 
            g.idGaraje AS id, 
            u.nombre AS nombre,     -- nombre del dueño
            g.direccion, 
            g.latitud, 
            g.longitud, 
            'garaje' AS tipo
            FROM GarajesPrivados g
            JOIN Usuarios u ON g.dueno_id = u.idUsuario
            WHERE u.nombre LIKE @nombre

      `);
      
       
    const resultados = [...estacionamientos.recordset, ...garajes.recordset];
    
    
    res.json(resultados);

  } catch (error) {
    console.error("Error buscando estacionamientos/garajes:", error);
    res.status(500).json({ error: "Error al buscar parqueos" });
  }
});
router.get("/propiedad/:tipo/:id", verificarToken, async (req, res) => {
  const { tipo, id } = req.params;
  const pool = await poolPromise;

  try {
    const field = tipo === 'Garaje' ? 'garaje_id' : 'estacionamiento_id'; // solo si hay garaje_id
    const campoSQL = tipo === 'Garaje' ? 'garaje_id' : 'estacionamiento_id';

    const result = await pool.request()
      .input('id', id)
      .query(`
        SELECT 
          puntuacion, comentario, fecha
        FROM Calificaciones
        WHERE ${campoSQL} = @id
      `);

    const comentarios = result.recordset;

    let promedio = 0;
    if (comentarios.length > 0) {
      promedio = comentarios.reduce((acc, c) => acc + c.puntuacion, 0) / comentarios.length;
    } else {
      comentarios.push({
        puntuacion: 5,
        comentario: "Sin comentarios disponibles, calificación por defecto.",
        fecha: new Date()
      });
      promedio = 5;
    }

    res.json({ promedio: parseFloat(promedio.toFixed(1)), comentarios });

  } catch (err) {
    console.error("Error al obtener comentarios:", err);
    res.status(500).json({ error: "Error al obtener los comentarios." });
  }
});

router.get("/propiedad/:id", verificarToken, async (req, res) => {
  const { id } = req.params;
  
  try {
    const pool = await poolPromise;

    const query = await pool.request()
      .input("id", id)
      .query(`
        SELECT 
          e.idEstacionamiento AS id,
          e.nombre,
          e.direccion,
          e.latitud,
          e.longitud,
          'estacionamiento' AS tipo
        FROM Estacionamientos e
        WHERE e.idEstacionamiento = @id

        UNION

        SELECT 
          g.idGaraje AS id,
          u.nombre AS nombre,
          g.direccion,
          g.latitud,
          g.longitud,
          'garaje' AS tipo
        FROM GarajesPrivados g
        JOIN Usuarios u ON g.dueno_id = u.idUsuario
        WHERE g.idGaraje = @id
      `);

    if (query.recordset.length === 0) {
      return res.status(404).json({ error: "Propiedad no encontrada" });
    }
    
    res.json(query.recordset[0]); // ✅ Solo 1 resultado con la misma estructura que el array `resultados`

  } catch (error) {
    console.error("Error al buscar propiedad:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});



module.exports = router;
