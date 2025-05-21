const express = require('express');
const router = express.Router();
const { poolPromise } = require('../db');
const verificarToken = require('../authMiddleware');

router.post('/guardar', verificarToken, async (req, res) => {
  const {
    nombre,
    direccion,
    latitud,
    longitud,
    disponibilidad,
    horario,
    fecha_inscripcion,
    anchura,
    altura,
    vehiculos  // Array de objetos: { tipo_vehiculo, tarifa_hora }
  } = req.body;
  
  try {
   
    const pool = await poolPromise;

    // Buscar el ID del usuario autenticado por email
    const resultUser = await pool.request()
      .input('email', req.usuario.email)
      .query(`SELECT idUsuario FROM Usuarios WHERE email = @email`);

    if (resultUser.recordset.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado en base de datos' });
    }

    const idUsuario = resultUser.recordset[0].idUsuario;

    // Insertar el estacionamiento
    const resultEst = await pool.request()
      .input('idPropietario', idUsuario)
      .input('nombre', nombre)
      .input('direccion', direccion)
      .input('latitud', latitud)
      .input('longitud', longitud)
      .input('disponibilidad', disponibilidad)
      .input('horario', horario)
      .input('fecha_inscripcion', fecha_inscripcion)
      .input('anchura', anchura)
      .input('altura', altura)
      .query(`
        INSERT INTO Estacionamientos (
          idPropietario, nombre, direccion, latitud, longitud,
          disponibilidad, horario, fecha_inscripcion, anchura, altura
        )
        OUTPUT INSERTED.idEstacionamiento
        VALUES (
          @idPropietario, @nombre, @direccion, @latitud, @longitud,
          @disponibilidad, @horario, @fecha_inscripcion, @anchura, @altura
        );
      `);

    const idEstacionamiento = resultEst.recordset[0].idEstacionamiento;

    // Insertar las tarifas asociadas
    const tarifasInsertadas = [];

    for (const tarifa of vehiculos) {
      console.log('Tarifa:', tarifa); // Debugging line
      await pool.request()
        .input('idEstacionamiento', idEstacionamiento)
        .input('tipo_vehiculo', tarifa.tipo_vehiculo)
        .input('tarifa_hora', tarifa.tarifa_hora)
        .query(`
          INSERT INTO TarifasEstacionamiento (idEstacionamiento, tipo_vehiculo, tarifa_hora)
          VALUES (@idEstacionamiento, @tipo_vehiculo, @tarifa_hora);
        `);

      tarifasInsertadas.push({
        tipo_vehiculo: tarifa.tipo_vehiculo,
        tarifa_hora: tarifa.tarifa_hora
      });
    }

    res.status(201).json({
      message: 'Estacionamiento y tarifas registrados correctamente',
      idEstacionamiento,
      nombre,
      direccion,
      tarifas: tarifasInsertadas
    });

  } catch (err) {
    console.error('❌ Error al registrar estacionamiento con tarifas:', err.message);
    res.status(500).json({ error: 'Error al registrar estacionamiento y tarifas' });
  }
});


router.put('/editar/:id', async (req, res) => {
  const {
    nombre,
    direccion,
    latitud,
    longitud,
    disponibilidad,
    horario,
    anchura,
    altura
  } = req.body;

  try {
    const pool = await poolPromise;
    await pool.request()
      .input('idEstacionamiento', req.params.id)
      .input('nombre',  nombre)
      .input('direccion',  direccion)
      .input('latitud',latitud)
      .input('longitud',  longitud)
      .input('disponibilidad', disponibilidad)
      .input('horario', horario)
      .input('anchura', anchura)
      .input('altura',  altura)
      .query(`UPDATE Estacionamientos 
              SET nombre = @nombre,
                  direccion = @direccion,
                  latitud = @latitud,
                  longitud = @longitud,
                  disponibilidad = @disponibilidad,
                  horario = @horario,
                  anchura = @anchura,
                  altura = @altura
              WHERE idEstacionamiento = @idEstacionamiento`);

    res.json({ mensaje: "Estacionamiento actualizado correctamente" });
  } catch (err) {
    console.error("❌ Error al actualizar estacionamiento:", err);
    res.status(500).json({ error: "Error al actualizar estacionamiento" });
  }
});

// GET /api/estacionamientos/:id
router.get('/:id', verificarToken, async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('idEstacionamiento', req.params.id)
      .query(`SELECT idEstacionamiento, nombre, direccion, latitud, longitud, disponibilidad, horario, fecha_inscripcion, anchura, altura 
              FROM Estacionamientos 
              WHERE idEstacionamiento = @idEstacionamiento`);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Estacionamiento no encontrado' });
    }

    res.json(result.recordset[0]);
  } catch (err) {
    console.error("❌ Error al obtener estacionamiento por ID:", err);
    res.status(500).json({ error: 'Error al obtener estacionamiento' });
  }
});

module.exports = router;
