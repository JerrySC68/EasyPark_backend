const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('✅ Backend EasyPark con seguridad Firebase corriendo');
});

app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api', require('./routes/login'));
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/estacionamientos', require('./routes/estacionamientos'));

app.listen(PORT, () => {

  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});