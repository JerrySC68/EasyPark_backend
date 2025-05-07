const express = require('express');
const cors = require('cors');
require('dotenv').config(); // Cargar variables del .env.example

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Ruta de prueba
app.get('/', (req, res) => {
    res.send('✅ Backend EasyPark está corriendo');
});

// Importar rutas de usuarios
app.use('/api/usuariods', require('./routes/usuarios'));

app.use('/api/estacionamientos',  require('./routes/estacionamientos'));
app.use('/api/garajes', require('./routes/usuarios'));


app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
