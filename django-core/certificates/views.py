from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import Certificate, Team
from .serializers import CertificateSerializer

import ssl
import socket
from datetime import datetime
from urllib.parse import urlparse

def get_ssl_info(domain):
    try:
        hostname = urlparse(domain).netloc or urlparse("https://" + domain).netloc or domain
        context = ssl.create_default_context()
        with socket.create_connection((hostname, 443), timeout=5) as sock:
            with context.wrap_socket(sock, server_hostname=hostname) as ssock:
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
                    "domain": hostname,
                    "cn": cn,
                    "start_date": start.date(),
                    "end_date": end.date(),
                    "days_remaining": days_remaining,
                    "status": status,
                }
    except Exception as e:
        print("❌ Erreur SSL :", str(e))
        return None


@api_view(['POST'])
def create_certificate(request):
    print("🧾 Données reçues :", request.data)
    domain = request.data.get('domain')
    team_id = request.data.get('team_id')  # 👈 nouveau
    custom_alert_days = request.data.get('custom_alert_days')
    custom_emails = request.data.get('custom_emails')
    check_frequency = request.data.get('check_frequency', 'daily')  # valeur par défaut

    if not domain:
        return Response({'error': 'Le champ "domain" est requis.'}, status=400)

    cert_info = get_ssl_info(domain)
    if not cert_info:
        return Response({'error': 'Impossible d’analyser le certificat SSL.'}, status=400)

    cert_info['check_frequency'] = check_frequency  # 👈 on ajoute la fréquence dans le dict
    if custom_alert_days:
        cert_info['custom_alert_days'] = custom_alert_days
    if custom_emails:
        cert_info['custom_emails'] = custom_emails
    if team_id:
        try:
            team = Team.objects.get(id=team_id)
            cert_info['team'] = team.id  # 👈 FK par ID
        except Team.DoesNotExist:
            return Response({'error': "L'équipe spécifiée est introuvable."}, status=400)

    serializer = CertificateSerializer(data=cert_info)
    if serializer.is_valid():
        cert, _ = Certificate.objects.update_or_create(
            domain=serializer.validated_data['domain'],
            defaults=serializer.validated_data
        )
        return Response({'message': 'Certificat analysé et enregistré avec succès.'})
    
    print("❌ Erreurs de validation :", serializer.errors)
    return Response(serializer.errors, status=400)


@api_view(['GET'])
def list_certificates(request):
    certs = Certificate.objects.all().order_by('-last_checked')
    serializer = CertificateSerializer(certs, many=True)
    return Response(serializer.data)
