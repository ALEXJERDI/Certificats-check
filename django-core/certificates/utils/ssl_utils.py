from datetime import datetime
from django.utils import timezone
import ssl
import socket

def get_ssl_info(domain):
    try:
        context = ssl.create_default_context()
        with socket.create_connection((domain, 443), timeout=5) as sock:
            with context.wrap_socket(sock, server_hostname=domain) as ssock:
                cert = ssock.getpeercert()
                start = datetime.strptime(cert['notBefore'], "%b %d %H:%M:%S %Y %Z")
                end = datetime.strptime(cert['notAfter'], "%b %d %H:%M:%S %Y %Z")
                days_remaining = (end - datetime.utcnow()).days
                status = (
                    "expired" if days_remaining < 0 else
                    "expiring" if days_remaining <= 15 else
                    "valid"
                )
                cn = ""
                for t in cert.get("subject", []):
                    if t[0][0] == "commonName":
                        cn = t[0][1]
                return {
                    "cn": cn,
                    "start_date": start.date(),
                    "end_date": end.date(),
                    "days_remaining": days_remaining,
                    "status": status
                }
    except Exception as e:
        print("❌ Erreur SSL :", str(e))
        return None

def get_next_check_date(frequency):
    now = timezone.now()
    return {
        "1h": now + timezone.timedelta(hours=1),
        "2h": now + timezone.timedelta(hours=2),
        "4h": now + timezone.timedelta(hours=4),
        "8h": now + timezone.timedelta(hours=8),
        "12h": now + timezone.timedelta(hours=12),
        "daily": now + timezone.timedelta(days=1),
        "weekly": now + timezone.timedelta(weeks=1),
        "monthly": now + timezone.timedelta(days=30),
    }.get(frequency, now + timezone.timedelta(days=1))
