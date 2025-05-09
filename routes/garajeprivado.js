const express = require('express');
const router = express.Router();
const { poolPromise } = require('../db');

router.post('/  ', async (req, res) => {
    const {
        dueno_id, direccion, latitud, longitud,
        horario, estado, disponibilidad, anchura, altura
    } = req.body;

    try {
        const pool = await poolPromise;
        await pool.request()
            .input('dueno_id', dueno_id)
            .input('direccion', direccion)
            .input('latitud', latitud)
            .input('longitud', longitud)
            .input('horario', horario)
            .input('estado', estado)
            .input('disponibilidad', disponibilidad)
            .input('anchura', anchura)
            .input('altura', altura)
            .query(`
                INSERT INTO GarajesPrivados (
                    dueno_id, direccion, latitud, longitud,
                    horario, estado, disponibilidad, anchura, altura
                ) VALUES (
                    @dueno_id, @direccion, @latitud, @longitud,
                    @horario, @estado, @disponibilidad, @anchura, @altura
                );
            `);

        res.status(201).json({ message: 'Garaje registrado correctamente' });
    } catch (err) {
        console.error('❌ Error al insertar garaje:', err.message);
        res.status(500).json({ error: 'Error al registrar garaje' });
    }
});

router.post('/tarifas-garaje', async (req, res) => {
    const { idGaraje, tipo_vehiculo, tarifa_hora } = req.body;

    try {
        const pool = await poolPromise;
        await pool.request()
            .input('idGaraje', idGaraje)
            .input('tipo_vehiculo', tipo_vehiculo)
            .input('tarifa_hora', tarifa_hora)
            .query(`
                INSERT INTO TarifasGaraje (idGaraje, tipo_vehiculo, tarifa_hora)
                VALUES (@idGaraje, @tipo_vehiculo, @tarifa_hora);
            `);

        res.status(201).json({ message: 'Tarifa de garaje registrada correctamente' });
    } catch (err) {
        console.error('❌ Error al insertar tarifa de garaje:', err.message);
        res.status(500).json({ error: 'Error al registrar tarifa de garaje' });
    }
});

module.exports = router;
