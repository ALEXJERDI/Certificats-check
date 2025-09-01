const express = require('express');
const axios = require('axios');
const cors = require('cors');
const sslChecker = require('ssl-checker');
const https = require('https');

const app = express();
app.use(express.json());
app.use(cors());

app.post('/check-cert', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL manquante" });
    }

    const domain = new URL(url).hostname;
    console.log(`🔍 Analyse SSL pour : ${domain}`);

    // 1. Récupère les infos SSL
    const certInfo = await sslChecker(domain, { method: "GET", port: 443 });

    console.log("✅ Certificat récupéré :", certInfo);

    // 2. Récupère le CN du certificat avec `https`
    const cn = await new Promise((resolve, reject) => {
      const req = https.get(`https://${domain}`, (res) => {
        const cert = res.socket.getPeerCertificate();
        resolve(cert.subject?.CN || domain); // fallback si CN absent
      });

      req.on('error', reject);
      req.end();
    });

    // 3. Préparation des données
    const formatDate = (dateStr) => new Date(dateStr).toISOString().split('T')[0];

    const payload = {
      domain: domain,
      cn: cn,
      start_date: formatDate(certInfo.validFrom),
      end_date: formatDate(certInfo.validTo),
      days_remaining: certInfo.daysRemaining,
      status: certInfo.valid
        ? certInfo.daysRemaining <= 10 ? "expiring" : "valid"
        : "expired"
    };

    console.log("📤 Envoi à Django :", payload);

    // 4. Envoi à Django
    const djangoResponse = await axios.post('http://localhost:8000/api/certificates/', payload);

    console.log("✅ Réponse Django :", djangoResponse.data);
    res.json({ message: "Certificat analysé et enregistré avec succès" });

  } catch (error) {
  if (error.response) {
    console.error("❌ Erreur Django :", error.response.data);
    res.status(error.response.status).json(error.response.data);
  } else if (error.request) {
    console.error("❌ Aucun retour de Django. Erreur request :", error.request);
    res.status(500).json({ error: "Pas de réponse de Django." });
  } else {
    console.error("❌ Erreur inconnue :", error);
    res.status(500).json({ error: "Erreur inconnue" });
  }
}
});

app.listen(3000, () => {
  console.log("✅ Backend Node SSL actif sur http://localhost:3000");
});
