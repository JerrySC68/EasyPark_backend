const express = require('express');
const cors = require('cors');
require('dotenv').config(); // Cargar variables del .env.example


const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Ruta de prueba
app.get('/', (req, res) => {
    res.send('✅ Backend EasyPark está corriendo');
});

// Importar rutas de usuarios
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/login', require('./routes/login'));
app.use('/api/registro', require('./routes/usuarios'));
app.use('/api/estacionamientos',  require('./routes/estacionamientos'));
app.use('/api/garajes', require('./routes/garajeprivado'));
app.use('/api/propiedades', require('./routes/propiedades')); 


app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
