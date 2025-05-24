const express = require('express');
const router = express.Router();
const { poolPromise } = require('../db');
const verificarToken = require('../authMiddleware');

router.post('/guardar', verificarToken, async (req, res) => {
  const {
    direccion,
    latitud,
    longitud,
    estado,
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
      .input('dueno_id', idUsuario)
      .input('direccion', direccion)
      .input('latitud', latitud)
      .input('longitud', longitud)
      .input('estado', estado)
      .input('disponibilidad', disponibilidad)
      .input('horario', horario)
      .input('fecha_inscripcion', fecha_inscripcion)
      .input('anchura', anchura)
      .input('altura', altura)
      
      .query(`
        INSERT INTO GarajesPrivados (
          dueno_id, direccion, latitud, longitud,estado,
          disponibilidad, horario, fecha_inscripcion, anchura, altura
        )
        OUTPUT INSERTED.idGaraje
        VALUES (
          @dueno_id, @direccion, @latitud, @longitud,@estado,
          @disponibilidad, @horario, @fecha_inscripcion, @anchura, @altura
        );
      `);

    const idGaraje = resultEst.recordset[0].idGaraje;

    // Insertar las tarifas asociadas
    const tarifasInsertadas = [];

    for (const tarifa of vehiculos) {
      console.log('Tarifa:', tarifa); // Debugging line
      await pool.request()
        .input('idGaraje', idGaraje)
        .input('tipo_vehiculo', tarifa.tipo_vehiculo)
        .input('tarifa_hora', tarifa.tarifa_hora)
        .query(`
          INSERT INTO TarifasGaraje(idGaraje, tipo_vehiculo, tarifa_hora)
          VALUES (@idGaraje, @tipo_vehiculo, @tarifa_hora);
        `);

      tarifasInsertadas.push({
        tipo_vehiculo: tarifa.tipo_vehiculo,
        tarifa_hora: tarifa.tarifa_hora
      });
    }

    res.status(201).json({
      message: 'Garaje y tarifas registrados correctamente',
      idGaraje,
      direccion,
      tarifas: tarifasInsertadas
    });

  } catch (err) {
    console.error('❌ Error al registrar garaje con tarifas:', err.message);
    res.status(500).json({ error: 'Error al registrar garaje y tarifas' });
  }
});


router.put('/editar/:id', verificarToken, async (req, res) => {
  const {
    direccion,
    latitud,
    longitud,
    disponibilidad,
    horario,
    anchura,
    altura,
    vehiculos = []
  } = req.body;

  const idGaraje = req.params.id;

  try {
    const pool = await poolPromise;

    // Actualizar garaje
    await pool.request()
      .input('idGaraje', idGaraje)
      .input('direccion', direccion)
      .input('latitud', latitud)
      .input('longitud', longitud)
      .input('disponibilidad', disponibilidad)
      .input('horario', horario)
      .input('anchura', anchura)
      .input('altura', altura)
      .query(`
        UPDATE GarajesPrivados 
        SET direccion = @direccion,
            latitud = @latitud,
            longitud = @longitud,
            disponibilidad = @disponibilidad,
            horario = @horario,
            anchura = @anchura,
            altura = @altura
        WHERE idGaraje = @idGaraje
      `);

    // Obtener tarifas actuales
    const tarifasBD = await pool.request()
      .input('idGaraje', idGaraje)
      .query(`SELECT idTarifaGaraje, tipo_vehiculo, tarifa_hora 
              FROM TarifasGaraje 
              WHERE idGaraje = @idGaraje`);

    const tarifasActuales = tarifasBD.recordset;
    const nuevasTarifasMap = new Map(vehiculos.map(v => [v.tipo_vehiculo, v]));
    const actualesMap = new Map(tarifasActuales.map(t => [t.tipo_vehiculo, t]));

    // Insertar nuevas tarifas
    for (const [tipo, nueva] of nuevasTarifasMap) {
      if (!actualesMap.has(tipo)) {
        await pool.request()
          .input('idGaraje', idGaraje)
          .input('tipo_vehiculo', nueva.tipo_vehiculo)
          .input('tarifa_hora', nueva.tarifa_hora)
          .query(`INSERT INTO TarifasGaraje(idGaraje, tipo_vehiculo, tarifa_hora)
                  VALUES (@idGaraje, @tipo_vehiculo, @tarifa_hora)`);
      } else if (actualesMap.get(tipo).tarifa_hora !== nueva.tarifa_hora || actualesMap.get(tipo).tipo_vehiculo !== nueva.tipo_vehiculo) {
        await pool.request()
          .input('idTarifaGaraje', actualesMap.get(tipo).idTarifa)
          .input('tipo_vehiculo', nueva.tipo_vehiculo)
          .input('tarifa_hora', nueva.tarifa_hora)
          .query(`UPDATE TarifasGaraje
                  SET tipo_vehiculo = @tipo_vehiculo, 
                      tarifa_hora = @tarifa_hora 
                  WHERE idTarifaGaraje = @idTarifaGaraje`);
      }
    }

    // Eliminar tarifas obsoletas
    for (const [tipo, actual] of actualesMap) {
      if (!nuevasTarifasMap.has(tipo)) {
        await pool.request()
          .input('idTarifaGaraje', actual.idTarifaGaraje)
          .query(`DELETE FROM TarifasGaraje WHERE idTarifaGaraje = @idTarifaGaraje`);
      }
    }

    res.json({ mensaje: "Garaje y tarifas actualizados correctamente" });
  } catch (err) {
    console.error("❌ Error al actualizar garaje:", err);
    res.status(500).json({ error: "Error al actualizar garaje privado" });
  }
});


// GET /api/garajes/:id
router.get('/:id', verificarToken, async (req, res) => {
  try {
    const pool = await poolPromise;

    const resultGaraje = await pool.request()
      .input('idGaraje', req.params.id)
      .query(`SELECT idGaraje, direccion, latitud, longitud, disponibilidad, horario, estado, anchura, altura ,camposLibres
              FROM GarajesPrivados 
              WHERE idGaraje = @idGaraje`);

    if (resultGaraje.recordset.length === 0) {
      return res.status(404).json({ error: 'Garaje no encontrado' });
    }

    const garaje = resultGaraje.recordset[0];

    const resultTarifas = await pool.request()
        .input('idGaraje', req.params.id)
        .query(`SELECT idTarifaGaraje,tipo_vehiculo, tarifa_hora 
                FROM TarifasGaraje 
                WHERE idGaraje = @idGaraje`);

      if (resultTarifas.recordset.length > 0) {
        garaje.vehiculos = resultTarifas.recordset;
      }


    res.json(garaje);
  } catch (err) {
    console.error("❌ Error al obtener garaje privado:", err);
    res.status(500).json({ error: 'Error al obtener garaje privado' });
  }
});


module.exports = router;
