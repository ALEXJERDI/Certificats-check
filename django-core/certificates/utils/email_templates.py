# certificates/utils/email_templates.py
from django.core.mail import get_connection, EmailMultiAlternatives
from django.conf import settings
from django.utils.html import escape
import logging

from certificates.models import AppEmailConfig  # <-- adjust import path to your model

logger = logging.getLogger(__name__)


def _load_app_email_config() -> AppEmailConfig | None:
    try:
        return AppEmailConfig.objects.get(pk=1)
    except AppEmailConfig.DoesNotExist:
        return None


def _build_connection_and_from():
    """
    Build a real SMTP connection from AppEmailConfig if present,
    otherwise fall back to settings-based backend.
    Returns (connection, from_email)
    """
    cfg = _load_app_email_config()
    if cfg:
        backend = "django.core.mail.backends.smtp.EmailBackend"
        conn = get_connection(
            backend=backend,
            host=cfg.host,
            port=cfg.port,
            username=(cfg.username or None),
            password=(cfg.password or None),
            use_tls=cfg.use_tls,
            use_ssl=cfg.use_ssl,
            fail_silently=False,
        )
        from_email = cfg.from_email or cfg.username or getattr(settings, "DEFAULT_FROM_EMAIL", None)
        return conn, from_email
    # fallback to settings
    conn = get_connection(fail_silently=False)
    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", None)
    return conn, from_email


def _collect_recipients(cert) -> list[str]:
    """
    Build recipient list from cert.custom_emails (+ team.default_emails if you use teams).
    """
    emails: list[str] = []
    if getattr(cert, "custom_emails", None):
        for part in str(cert.custom_emails).split(","):
            e = part.strip()
            if e:
                emails.append(e)

    team = getattr(cert, "team", None)
    if team and getattr(team, "default_emails", None):
        for part in str(team.default_emails).split(","):
            e = part.strip()
            if e and e not in emails:
                emails.append(e)

    # As a last resort, avoid empty recipient list
    if not emails:
        fallback = getattr(settings, "DEFAULT_FROM_EMAIL", None)
        if fallback:
            emails.append(fallback)
    return emails


def send_expiring_cert_email(cert) -> bool:
    """
    Send alert for a single cert object.
    Returns True if email was sent (>=1), else False.
    """
    conn, from_email = _build_connection_and_from()
    recipients = _collect_recipients(cert)

    # Defensive: we need at least one recipient and a from address
    if not recipients or not from_email:
        logger.error("Email not sent: missing recipients or from_email (recipients=%s, from=%s)", recipients, from_email)
        return False

    # Safe fields
    domain = escape(getattr(cert, "domain", "-"))
    cn = escape(getattr(cert, "cn", "-"))
    status = escape(getattr(cert, "status", "-"))
    end_date = escape(str(getattr(cert, "end_date", "-")))
    days_left = getattr(cert, "days_remaining", None)

    subject = f"⚠️ Certificat proche de l’expiration : {domain}"
    text = (
        f"Le certificat SSL de {domain} expirera dans {days_left} jours.\n"
        f"Date d’expiration : {end_date}\n"
        f"CN : {cn}\n"
        f"Statut : {status}"
    )
    html = f"""
    <html>
      <body style="font-family: Arial, sans-serif; background-color:#f4f4f4; padding:20px;">
        <div style="max-width:600px; margin:auto; background:#fff; border-radius:8px; padding:20px; box-shadow:0 0 8px rgba(0,0,0,0.08);">
          <h2 style="color:#d9534f; margin-top:0;">⚠️ Alerte : Certificat SSL expirant</h2>
          <p>Le certificat du domaine <strong style="color:#0275d8;">{domain}</strong> expire dans
             <strong>{days_left} jours</strong>.</p>
          <table style="width:100%; margin-top:15px; border-collapse:collapse;">
            <tr><td style="padding:4px 0;"><strong>CN :</strong></td><td>{cn}</td></tr>
            <tr><td style="padding:4px 0;"><strong>Expiration :</strong></td><td>{end_date}</td></tr>
            <tr><td style="padding:4px 0;"><strong>Statut :</strong></td><td>{status}</td></tr>
          </table>
          <p style="margin-top:18px;">Merci de planifier le renouvellement rapidement.</p>
        </div>
      </body>
    </html>
    """

    try:
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text,
            from_email=from_email,
            to=recipients,
            connection=conn,   # ✅ attach the connection here
        )
        msg.attach_alternative(html, "text/html")
        sent = msg.send()
        return sent > 0
    except Exception as e:
        logger.exception("Email send failed for cert[%s %s]: %s", getattr(cert, "id", "?"), domain, e)
        return False
