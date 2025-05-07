const express = require('express');
const router = express.Router();
const { poolPromise } = require('../db');




router.post('/', async (req, res) => {
    const {
        idPropietario, nombre, direccion, latitud, longitud,
        disponibilidad, horario, fecha_inscripcion, anchura, altura,
        tarifas // Array de objetos: { tipo_vehiculo, tarifa_hora }
    } = req.body;

    try {
        const pool = await poolPromise;

        // 1. Insertar estacionamiento y obtener el ID
        const result = await pool.request()
            .input('idPropietario', idPropietario)
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

        const idEstacionamiento = result.recordset[0].idEstacionamiento;

        // 2. Insertar tarifas asociadas y guardar las que se insertan
        const tarifasInsertadas = [];

        for (const tarifa of tarifas) {
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

        // 3. Responder con los datos insertados
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
router.get('/estacionamientos', async (req, res) => {
    try {
        const pool = await poolPromise;

        // 1. Obtener estacionamientos
        const estacionamientosResult = await pool.request()
            .query('SELECT * FROM Estacionamientos');

        const estacionamientos = estacionamientosResult.recordset;

        // 2. Obtener tarifas
        const tarifasResult = await pool.request()
            .query('SELECT * FROM TarifasEstacionamiento');

        const tarifas = tarifasResult.recordset;

        // 3. Agrupar tarifas por estacionamiento
        const respuesta = estacionamientos.map(est => {
            const tarifasAsociadas = tarifas.filter(t => t.idEstacionamiento === est.idEstacionamiento);
            return {
                ...est,
                tarifas: tarifasAsociadas
            };
        });

        res.json(respuesta);
    } catch (err) {
        console.error('❌ Error al obtener estacionamientos:', err.message);
        res.status(500).json({ error: 'Error al obtener estacionamientos' });
    }
});
module.exports = router;
