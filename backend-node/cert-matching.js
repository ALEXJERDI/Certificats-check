// cert-matching.js
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const forge = require('node-forge');
const cors = require('cors');

const app = express();
app.use(cors());

// Endpoint qui fait le matching à partir de l'ID du certificat
app.get('/api/match-key/:id', async (req, res) => {
  const certId = req.params.id;

  try {
    // 🔐 Appelle Django pour obtenir le chemin de la clé
    const djangoRes = await axios.get(`http://localhost:8000/api/private-key/${certId}/`);
    const keyPath = djangoRes.data.key_path;

    // 📄 Lis le certificat
    const certPem = fs.readFileSync(`./certs/${certId}.crt`, 'utf8');
    const keyPem = fs.readFileSync(keyPath, 'utf8');

    const cert = forge.pki.certificateFromPem(certPem);
    const privateKey = forge.pki.privateKeyFromPem(keyPem);

    const pubFromCert = forge.pki.publicKeyToPem(cert.publicKey);
    const pubFromKey = forge.pki.publicKeyToPem(privateKey.publicKey);

    const match = pubFromCert === pubFromKey;

    res.json({ match });
  } catch (error) {
    console.error("❌ Matching Error:", error.message);
    res.status(500).json({ error: "Échec du matching" });
  }
});

// Tu peux écouter sur un port séparé si tu préfères :
// app.listen(3001, () => console.log("✅ cert-matching actif sur 3001"));

module.exports = app;
