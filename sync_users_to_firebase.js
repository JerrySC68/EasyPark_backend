require('dotenv').config();

const admin = require('firebase-admin');
const { sql, poolPromise } = require('./db');
const serviceAccount = require('./config/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function syncUsersToFirebase() {
  try {
    const pool = await poolPromise;
    console.log("✅ Conectado a Azure SQL");

    const result = await pool.request().query('SELECT nombre, email, password FROM Usuarios');
    const usuarios = result.recordset;

    for (const usuario of usuarios) {
      const { nombre, email, password } = usuario;

      // Validar contraseña
      if (typeof password !== 'string' || password.length < 6) {
        console.error(`❌ Contraseña inválida para ${email}: Debe tener al menos 6 caracteres.`);
        continue;
      }

      try {
        // Verificar si ya existe en Firebase
        await admin.auth().getUserByEmail(email);
        console.log(`⚠️ Usuario ya existe en Firebase: ${email}`);
      } catch (error) {
        if (error.code === 'auth/user-not-found') {
          try {
            const user = await admin.auth().createUser({
              email,
              password,
              displayName: nombre
            });
            console.log(`✅ Usuario creado: ${email} (UID: ${user.uid})`);
          } catch (errorCreacion) {
            console.error(`❌ Error al crear ${email}: ${errorCreacion.message}`);
          }
        } else {
          console.error(`❌ Error al verificar ${email}: ${error.message}`);
        }
      }
    }

    console.log('🚀 Proceso de sincronización terminado.');

  } catch (err) {
    console.error('❌ Error al consultar usuarios desde SQL Server:', err.message);
  }
}

syncUsersToFirebase();
