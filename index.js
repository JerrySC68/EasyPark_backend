const express = require('express');
const cors = require('cors');
require('dotenv').config(); // Cargar variables del .env.example
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: 'https://easypark-3f372.web.app', // dominio del frontend en Firebase
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));

app.use(express.json());

// Ruta de prueba
app.get('/', (req, res) => {
    res.send('✅ Backend EasyPark está corriendo');
});

// Importar rutas de usuarios
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/login', require('./routes/login'));
//app.use('/api/registro', require('./routes/usuarios'));
app.use('/api/comentarios', require('./routes/comentario'));
app.use('/api/estacionamientos',  require('./routes/estacionamientos'));
app.use('/api/garajes', require('./routes/garajeprivado'));
app.use('/api/propiedades', require('./routes/propiedades')); 

const interfaces = os.networkInterfaces();
const localIP = Object.values(interfaces)
  .flat()
  .find(i => i.family === 'IPv4' && !i.internal)?.address || 'localhost';

app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Servidor corriendo en:');
  console.log(`   • http://localhost:${PORT}`);
  console.log(`   • http://${localIP}:${PORT}`);
});