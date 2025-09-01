const express = require('express');
const axios = require('axios');
const cors = require('cors');
const sslChecker = require('ssl-checker');
const https = require('https');
const certMatching = require('./cert-matching'); // ton app pour matching

const app = express();
const DJANGO_API_BASE = process.env.DJANGO_API_BASE || 'http://127.0.0.1:8000'; // IPv4
app.use(express.json());
app.use(cors());
app.use(certMatching);  // matching via /api/match-key/:id


app.get('/get-smtp-config/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;
    const response = await axios.get(`${DJANGO_API_BASE}/api/smtp/team/${teamId}/`);
    res.json(response.data);
  } catch (error) {
    if (error.response) {
      console.error("❌ Erreur Django (SMTP) :", error.response.data);
      res.status(error.response.status).json(error.response.data);
    } else {
      console.error("❌ Erreur inconnue (SMTP) :", error);
      res.status(500).json({ error: "Erreur inconnue lors de la récupération SMTP" });
    }
  }
});

app.post('/check-cert', async (req, res) => {
  try {
    const { url, team, custom_alert_days, custom_emails, check_frequency } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL manquante" });
    }

    const domain = new URL(url).hostname;
    console.log(`🔍 Analyse SSL pour : ${domain}`);

    // 1. Récupère les infos SSL
    const certInfo = await sslChecker(domain, { method: "GET", port: 443 });
    console.log("✅ Certificat récupéré :", certInfo);

    // 2. Récupère le CN via HTTPS
    const cn = await new Promise((resolve, reject) => {
      const req = https.get(`https://${domain}`, (res) => {
        const cert = res.socket.getPeerCertificate();
        resolve(cert.subject?.CN || domain);
      });
      req.on('error', reject);
      req.end();
    });

    // 3. Format date (YYYY-MM-DD)
    const formatDate = (dateStr) => new Date(dateStr).toISOString().split('T')[0];

    // 4. Nettoyage des emails
    const cleanedEmails = custom_emails
      ? custom_emails
        .split(',')
        .map(email => email.trim())
        .filter(email => email.includes('@'))
        .join(',')
      : undefined;

    // 5. Construction du payload
    const payload = {
      domain: domain,
      cn: cn,
      start_date: formatDate(certInfo.validFrom),
      end_date: formatDate(certInfo.validTo),
      days_remaining: certInfo.daysRemaining,
      status: certInfo.valid
        ? certInfo.daysRemaining <= 10 ? "expiring" : "valid"
        : "expired",
      ...(team && { team }),
      ...(custom_alert_days && { custom_alert_days }),
      ...(cleanedEmails && { custom_emails: cleanedEmails }),
      ...(check_frequency && { check_frequency }),
    };

    console.log("📤 Envoi à Django :", payload);

    // 6. Envoi à Django
    const djangoResponse = await axios.post(
      `${DJANGO_API_BASE}/api/certificates/`,   // matches your Django route
      payload,
      { timeout: 10000, validateStatus: () => true }
    );
    console.log("↩ Django status:", djangoResponse.status, "data:", djangoResponse.data);
    console.log("↩ Django status:", djangoResponse.status, "data:", djangoResponse.data);
    console.log("✅ Réponse Django :", djangoResponse.data);

    console.log('🛡️ CA utilisée :', process.env.NODE_EXTRA_CA_CERTS || 'Système par défaut');
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
