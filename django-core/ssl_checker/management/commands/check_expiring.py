# ssl_checker/management/commands/check_expiring.py
from django.core.management.base import BaseCommand
from certificates.models import Certificate
from certificates.utils.email_templates import send_expiring_cert_email

class Command(BaseCommand):
    help = "Envoie les alertes pour les certificats critiques (valid/expiring/expired si seuil franchi)."

    def handle(self, *args, **kwargs):
        certs = Certificate.objects.filter(
            status__in=["valid", "expiring", "expired"],   # <-- inclure valid
            notified=False
        )

        if not certs.exists():
            self.stdout.write("Aucun certificat à notifier.")
            return

        self.stdout.write(f"Vérification des alertes pour {certs.count()} certificat(s)...")

        for cert in certs:
            alert_days = cert.custom_alert_days or (cert.team.default_alert_days if cert.team else 15)
            # log de debug pour comprendre pourquoi on notifie / pas
            self.stdout.write(
                f"→ {cert.domain}: status={cert.status}, "
                f"days_remaining={cert.days_remaining}, alert_days={alert_days}"
            )

            if cert.days_remaining is None:
                self.stdout.write(self.style.WARNING(f"   (skip) days_remaining est None"))
                continue

            if cert.days_remaining <= alert_days:
                sent = send_expiring_cert_email(cert)
                if sent:
                    cert.notified = True
                    cert.save(update_fields=["notified"])
                    self.stdout.write(self.style.SUCCESS(
                        f"   ✓ Alerte envoyée (expire dans {cert.days_remaining} jours)"
                    ))
                else:
                    self.stdout.write(self.style.ERROR(
                        f"   ✗ Échec d'envoi pour {cert.domain}"
                    ))
            else:
                self.stdout.write(f"   ⏳ Pas encore le moment (seuil {alert_days})")

        self.stdout.write(self.style.SUCCESS("Alerte(s) envoyée(s) si nécessaire."))
