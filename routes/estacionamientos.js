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


router.put('/editar/:id', verificarToken, async (req, res) => {
  const {
    nombre,
    direccion,
    latitud,
    longitud,
    disponibilidad,
    horario,
    anchura,
    altura,
    vehiculos = []
  } = req.body;

  const idEstacionamiento = req.params.id;

  try {
    const pool = await poolPromise;

    // Actualizar datos del estacionamiento
    await pool.request()
      .input('idEstacionamiento', idEstacionamiento)
      .input('nombre', nombre)
      .input('direccion', direccion)
      .input('latitud', latitud)
      .input('longitud', longitud)
      .input('disponibilidad', disponibilidad)
      .input('horario', horario)
      .input('anchura', anchura)
      .input('altura', altura)
      .query(`
        UPDATE Estacionamientos 
        SET nombre = @nombre,
            direccion = @direccion,
            latitud = @latitud,
            longitud = @longitud,
            disponibilidad = @disponibilidad,
            horario = @horario,
            anchura = @anchura,
            altura = @altura
        WHERE idEstacionamiento = @idEstacionamiento
      `);

    // Obtener tarifas actuales
    const tarifasBD = await pool.request()
      .input('idEstacionamiento', idEstacionamiento)
      .query(`SELECT idTarifaEst, tipo_vehiculo, tarifa_hora 
              FROM TarifasEstacionamiento 
              WHERE idEstacionamiento = @idEstacionamiento`);

    const tarifasActuales = tarifasBD.recordset;

    // Crear índices por tipo para comparar
    const nuevasTarifasMap = new Map(vehiculos.map(v => [v.tipo_vehiculo, v]));
    const actualesMap = new Map(tarifasActuales.map(t => [t.tipo_vehiculo, t]));

    // Insertar nuevas tarifas
    for (const [tipo, nueva] of nuevasTarifasMap) {
      if (!actualesMap.has(tipo)) {
        await pool.request()
          .input('idEstacionamiento', idEstacionamiento)
          .input('tipo_vehiculo', nueva.tipo_vehiculo)
          .input('tarifa_hora', nueva.tarifa_hora)
          .query(`INSERT INTO TarifasEstacionamiento (idEstacionamiento, tipo_vehiculo, tarifa_hora)
                  VALUES (@idEstacionamiento, @tipo_vehiculo, @tarifa_hora)`);
      } else if (actualesMap.get(tipo).tarifa_hora !== nueva.tarifa_hora) {
        // Actualizar si el precio cambió
        await pool.request()
        .input('idTarifaEst', actualesMap.get(tipo).idTarifa)
        .input('tipo_vehiculo', nueva.tipo_vehiculo)
        .input('tarifa_hora', nueva.tarifa_hora)
        .query(`
          UPDATE TarifasEstacionamiento 
          SET tipo_vehiculo = @tipo_vehiculo, 
              tarifa_hora = @tarifa_hora 
          WHERE idTarifaEst = @idTarifaEst
        `);

      }
    }

    // Eliminar las que ya no están
    for (const [tipo, actual] of actualesMap) {
      if (!nuevasTarifasMap.has(tipo)) {
        await pool.request()
          .input('idTarifaEst', actual.idTarifaEst)
          .query(`DELETE FROM TarifasEstacionamiento WHERE idTarifaEst = @idTarifaEst`);
      }
    }

    res.json({ mensaje: "Estacionamiento y tarifas actualizados correctamente" });
  } catch (err) {
    console.error("❌ Error al actualizar:", err);
    res.status(500).json({ error: "Error al actualizar estacionamiento" });
  }
});


// GET /api/estacionamientos/:id
router.get('/:id', verificarToken, async (req, res) => {
  try {
    const pool = await poolPromise;

    const resultEst = await pool.request()
      .input('idEstacionamiento', req.params.id)
      .query(`SELECT idEstacionamiento, nombre, direccion, latitud, longitud, disponibilidad, horario, anchura, altura ,camposLibres
              FROM Estacionamientos 
              WHERE idEstacionamiento = @idEstacionamiento`);

    if (resultEst.recordset.length === 0) {
      return res.status(404).json({ error: 'Estacionamiento no encontrado' });
    }

    const estacionamiento = resultEst.recordset[0];

    const resultTarifas = await pool.request()
      .input('idEstacionamiento', req.params.id)
      .query(`SELECT idTarifaEst, tipo_vehiculo, tarifa_hora 
              FROM TarifasEstacionamiento 
              WHERE idEstacionamiento = @idEstacionamiento`);
  if (resultTarifas.recordset.length > 0) {
       estacionamiento.vehiculos = resultTarifas.recordset;
    }
   
    




    res.json(estacionamiento);
  } catch (err) {
    console.error("❌ Error al obtener estacionamiento:", err);
    res.status(500).json({ error: 'Error al obtener estacionamiento' });
  }
});


module.exports = router;
