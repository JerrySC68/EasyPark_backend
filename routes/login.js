const express = require('express');
const router = express.Router();
const admin = require('../config/firebaseConfig'); // donde configuras firebase-admin

router.post('/verificar-token', async (req, res) => {
  const { token } = req.body;

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    res.status(200).json({ uid: decoded.uid, email: decoded.email });
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
});



module.exports = router;