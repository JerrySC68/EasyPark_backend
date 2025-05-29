const admin = require('./config/firebaseConfig');

const verificarToken = async (req, res, next) => {
  const token =
  req.headers.authorization?.split('Bearer ')[1] || req.query.token;


  if (!token) return res.status(401).json({ error: 'Token no proporcionado' });

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.usuario = decodedToken; // lo puedes usar más adelante si quieres saber quién hizo la petición
    next();
  } catch (error) {
    console.error('❌ Error al verificar token Firebase:', error.message);
    res.status(403).json({ error: 'Token inválido' });
  }
};

module.exports = verificarToken;
