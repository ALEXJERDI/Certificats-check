# ssl_checker/management/commands/check_scheduled.py
from django.core.management.base import BaseCommand
from django.utils import timezone
from certificates.models import Certificate
from certificates.utils.ssl_utils import get_ssl_info, get_next_check_date
from django.core.management import call_command

def normalize_domain(d: str) -> str:
    d = (d or "").strip()
    if d.startswith("http://") or d.startswith("https://"):
        d = d.split("://", 1)[1]
    return d.split("/", 1)[0]  # garde juste l'hôte

class Command(BaseCommand):
    help = "Vérifie les certificats planifiés (ou un certificat ciblé avec --force --domain)."

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true', help='Forcer la vérification immédiate')
        parser.add_argument('--domain', type=str, help='Nom de domaine à vérifier avec --force')

    def handle(self, *args, **options):
        now = timezone.now()
        force = options.get('force')
        domain = options.get('domain')

        if force and domain:
            try:
                certs = [Certificate.objects.get(domain=domain)]
                self.stdout.write(f"Forçage activé : Vérification immédiate de {domain}")
            except Certificate.DoesNotExist:
                self.stdout.write(f"Aucun certificat trouvé pour le domaine : {domain}")
                return
        else:
            certs = Certificate.objects.filter(next_check_at__lte=now)



            
            due_qs = Certificate.objects.filter(next_check_at__lte=now).order_by('next_check_at')
            self.stdout.write(f"[DEBUG] due_count = {due_qs.count()}")
            for row in due_qs.values('id','domain','next_check_at')[:10]:
                self.stdout.write(f"[DEBUG] due -> {row['domain']} @ {row['next_check_at'].isoformat()}")

            if not due_qs.exists():
                next_up = Certificate.objects.order_by('next_check_at').first()
                if not next_up:
                    self.stdout.write("Aucun certificat en base.")
                    return
                self.stdout.write(
                    f"Aucun certificat à vérifier. Prochain: {next_up.domain} à "
                    f"{next_up.next_check_at.isoformat()} (now={now.isoformat()})"
                )
                return

            certs = due_qs  # on réutilise le queryset déjà ordonné
            self.stdout.write(f"Vérification de {certs.count()} certificat(s)...")











            if not certs.exists():
                # ⚠️ On log le prochain check planifié pour info
                next_up = Certificate.objects.order_by('next_check_at').first()
                if not next_up:
                    self.stdout.write("Aucun certificat en base.")
                    return
                delta = next_up.next_check_at - now
                mins = int(max(delta.total_seconds(), 0) // 60)
                self.stdout.write(
                    f"Aucun certificat à vérifier pour l'instant. "
                    f"Prochain: {next_up.domain} à {next_up.next_check_at} (~{mins} min)."
                )
                return

            self.stdout.write(f"Vérification de {certs.count()} certificat(s)...")

        for cert in certs:
            self.stdout.write(f"{cert.domain} (fréquence: {cert.check_frequency})")

            host = normalize_domain(cert.domain)
            ssl_data = get_ssl_info(host)

            if not ssl_data:
                self.stdout.write(f"Impossible de récupérer les infos SSL pour {cert.domain}")
                continue

            cert.cn = ssl_data['cn']
            cert.start_date = ssl_data['start_date']
            cert.end_date = ssl_data['end_date']
            cert.days_remaining = ssl_data['days_remaining']
            cert.status = ssl_data['status']
            cert.last_checked = now
            cert.next_check_at = get_next_check_date(cert.check_frequency)
            cert.save()

            self.stdout.write(f"Mis à jour : {cert.domain} → Prochaine vérification : {cert.next_check_at}")

        # Inclure 'valid' : l'envoi se fera SEULEMENT si days_remaining <= seuil dans check_expiring.
        should_notify = Certificate.objects.filter(
            status__in=["valid", "expiring", "expired"],
            notified=False
        ).exists()

        if should_notify:
            count_pending = Certificate.objects.filter(
                status__in=["valid", "expiring", "expired"],
                notified=False
            ).count()
            self.stdout.write(f"~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
            self.stdout.write(f"Des certificats à examiner ({count_pending}). Appel de check_expiring...")
            call_command('check_expiring')
        else:
            self.stdout.write("Aucun certificat critique à notifier.")
