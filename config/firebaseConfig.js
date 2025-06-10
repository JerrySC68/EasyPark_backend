// config/firebaseConfig.js
const admin = require('firebase-admin');
//const serviceAccount = require('./serviceAccountKey.json');
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

// 🔥 Esta línea es clave para que funcione bien la private_key
serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
