<p align="center">
  <img src="https://img.shields.io/badge/SSL-TLS-blue?logo=letsencrypt" alt="Certificat Check">
</p>

<h1 align="center">🔒 Certificat Check</h1>
<p align="center">
  Check SSL/TLS certificates (expiry, validation, cryptography) with alerts & team management.  
  <br/>
  **Free plan → 1 certificat (test)** | **Premium → +10k certificats**
</p>

<p align="center">
  <a href="https://github.com/{{USER}}/certificat-check/actions">
    <img src="https://img.shields.io/github/actions/workflow/status/{{USER}}/certificat-check/ci.yml?label=CI" alt="CI Status">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/github/license/{{USER}}/certificat-check" alt="License">
  </a>
  <a href="https://example.com/premium">
    <img src="https://img.shields.io/badge/Upgrade-Premium-blue?logo=githubsponsors" alt="Premium">
  </a>
</p>

---

## 🌍 Aperçu | Overview

**Certificat Check** est une plateforme de monitoring SSL/TLS :  
- Vérifie la validité et la date d’expiration de certificats  
- Analyse la méthode de chiffrement & l’état de validation  
- Envoie des alertes automatiques par email (Outlook/Gmail)  
- Interface web moderne (React + MUI)  
- Gestion d’équipes : chaque certificat peut être associé à un ou plusieurs groupes  
- Système batch arrière-plan qui traite les certificats proches d’expiration  

⚡ **Free** : 1 certificat (test)  
🚀 **Premium** : +10,000 certificats, sans limite, notifications avancées  

---

## ✨ Fonctionnalités | Features

### Free
- 🔍 Vérification d’1 certificat SSL/TLS  
- 📅 Alertes email automatiques sur expiration  
- 🎨 Interface front-end visuelle (React + Vite + MUI)  

### Premium
- 🔥 Support de **10k+ certificats en parallèle**  
- 👥 Multi-team illimité  
- 📊 Monitoring temps réel + statistiques  
- 📨 Intégrations étendues (Slack, Teams, Webhooks)  
- ⚡ Notifications avancées & SLA Premium  

> 👉 Passez en **Premium** ici : [Lien vers Premium](https://example.com/premium)  

---

## 🏗️ Stack Technique

- **Backend** : Python + Django (gestion des certificats & batch scheduler)  
- **Backend Node.js** : traitement complémentaire (notifs, workers)  
- **Frontend** : React + Vite + MUI (interface moderne & responsive)  
- **DB** : {{ta base de données}}  

---

## 🚀 Installation locale | Local Setup

### Prérequis
- Python 3.10+  
- Node.js 20+  
- npm + pip  
- Virtualenv  

### Étapes
```bash
# 1. Cloner le repo
git clone https://github.com/{{USER}}/certificat-check.git
cd certificat-check

# 2. Backend Django
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cd django-core
python manage.py runserver

# 3. Backend Node.js
cd backend-node
npm install
node index.js

# 4. Frontend React + Vite
cd frontend
npm install
npm run dev

👉 Ouvrir le navigateur sur http://localhost:5343 (ou le port affiché par Vite).

## 🎬 Démo | Demo

- Screenshots : *(à insérer)*
- Vidéo démo : *(à insérer)*
- [Lien Premium](https://example.com/premium)

## 📚 Exemples d’utilisation | Usage Examples

### Vérifier un certificat
```bash
python manage.py check_cert --url https://example.com
