# certificates/utils/email_templates.py

from django.core.mail import EmailMultiAlternatives

def send_expiring_cert_email(cert, days_left):
    subject = f"⚠️ Certificat proche de l’expiration : {cert.domain}"

    text = (
        f"Le certificat SSL de {cert.domain} expirera dans {days_left} jours.\n"
        f"Date d’expiration : {cert.end_date}\n"
        f"CN : {cert.cn}\n"
        f"Statut : {cert.status}"
    )

    html = f"""
    <html>RZ
      <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
        <div style="max-width: 600px; margin: auto; background: white; border-radius: 8px; padding: 20px; box-shadow: 0 0 8px rgba(0,0,0,0.1);">
          <h2 style="color: #d9534f;">⚠️ Alerte : Certificat SSL expirant</h2>
          <p>Le certificat du domaine <strong style="color: #0275d8;">{cert.domain}</strong> expire dans <strong>{days_left} jours</strong>.</p>
          <table style="width: 100%; margin-top: 15px; border-collapse: collapse;">
            <tr><td><strong>CN :</strong></td><td>{cert.cn}</td></tr>
            <tr><td><strong>Expiration :</strong></td><td>{cert.end_date}</td></tr>
            <tr><td><strong>Statut :</strong></td><td>{cert.status}</td></tr>
          </table>
          <p style="margin-top: 20px;">Merci de planifier le renouvellement rapidement.</p>
        </div>
      </body>
    </html>
    """

    email = EmailMultiAlternatives(
        subject,
        text,
        "noreply@attijariwafa.com",
        ["alexjerdi800@gmail.com"]
    )
    email.attach_alternative(html, "text/html")
    email.send()
