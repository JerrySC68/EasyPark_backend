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

module.exports = router;
