# ssl_checker/management/commands/check_expiring.py

from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from certificates.models import Certificate
from certificates.utils.email_templates import send_expiring_cert_email

class Command(BaseCommand):
    help = "Vérifie les certificats expirant dans ≤ 20 jours et envoie une alerte HTML"

    def handle(self, *args, **kwargs):
        today = timezone.now().date()
        threshold = today + timedelta(days=20)

        certs = Certificate.objects.filter(
            end_date__lte=threshold,
            status__in=["valid", "expiring"],
            notified=False
        )

        if not certs.exists():
            self.stdout.write("✅ Aucun certificat proche de l'expiration.")
            return

        for cert in certs:
            days_left = (cert.end_date - today).days

            send_expiring_cert_email(cert, days_left)  

            if cert.status == "valid":
                cert.status = "expiring"
            cert.notified = True
            cert.save()

            self.stdout.write(f"✅ Alerte envoyée pour {cert.domain} (expire dans {days_left} jours)")
