from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from .models import Certificate, Team
from .serializers import CertificateSerializer,TeamSerializer
from certificates.utils.ssl_utils import get_ssl_info, get_next_check_date
from django.http import HttpResponse
import ssl, socket
from django.http import JsonResponse
from .models import Certificate
from ssl_checker import settings



import requests
from decouple import config


import ssl
import socket
from datetime import datetime
from urllib.parse import urlparse


# certificates/views.py
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.core.mail import get_connection, send_mail
from django.conf import settings
from .models import AppEmailConfig

PRESETS = {
    "gmail":   dict(host="smtp.gmail.com",      port=587, use_tls=True,  use_ssl=False),
    "outlook": dict(host="smtp.office365.com",  port=587, use_tls=True,  use_ssl=False),
    "yahoo":   dict(host="smtp.mail.yahoo.com", port=465, use_tls=False, use_ssl=True),
    "custom":  None,  # use values provided by user
}

def _sanitize(cfg: AppEmailConfig):
    if not cfg:
        return {"exists": False}
    return {
        "exists": True,
        "provider": cfg.provider or "custom",
        "host": cfg.host,
        "port": cfg.port,
        "use_tls": cfg.use_tls,
        "use_ssl": cfg.use_ssl,
        "username": cfg.username,
        "from_email": cfg.from_email or cfg.username,
        "password": "********" if cfg.password else "",  # never leak
    }

@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def email_config(request):
    """
    GET  -> returns current config (masked password)
    POST -> saves/updates config; body accepts:
            provider: 'gmail'|'outlook'|'yahoo'|'custom'
            username, password, from_email (optional)
            If provider='custom', also send host, port, use_tls, use_ssl
            Optional: test_to (email) to send a test message after saving
    """
    cfg, _ = AppEmailConfig.objects.get_or_create(pk=1)

    if request.method == "GET":
        return Response(_sanitize(cfg if cfg.username or cfg.host else None))

    # --- POST: upsert ---
    data = request.data or {}
    provider = (data.get("provider") or "custom").lower()
    preset = PRESETS.get(provider)

    # Host/port/security from preset or custom
    if preset:
        cfg.host = preset["host"]
        cfg.port = int(preset["port"])
        cfg.use_tls = bool(preset["use_tls"])
        cfg.use_ssl = bool(preset["use_ssl"])
    else:
        # custom
        if data.get("host"): cfg.host = data["host"]
        if data.get("port") is not None: cfg.port = int(data["port"])
        if "use_tls" in data: cfg.use_tls = bool(data["use_tls"])
        if "use_ssl" in data: cfg.use_ssl = bool(data["use_ssl"])

    # Auth fields
    if data.get("username") is not None:
        cfg.username = data["username"].strip()

    incoming_pw = data.get("password", None)
    # keep existing password if user left it blank or sent masked value
    if incoming_pw and incoming_pw.strip() and incoming_pw != "********":
        cfg.password = incoming_pw

    if data.get("from_email") is not None:
        cfg.from_email = data["from_email"].strip() or cfg.username

    cfg.provider = provider
    cfg.save()

    # Optional: test send
    test_to = (data.get("test_to") or "").strip()
    if test_to:
        try:
            conn = get_connection(
                host=cfg.host, port=cfg.port,
                username=cfg.username, password=cfg.password,
                use_tls=cfg.use_tls, use_ssl=cfg.use_ssl, timeout=20
            )
            send_mail(
                subject="[SSL Monitor] Test SMTP OK",
                message="Votre configuration SMTP fonctionne.",
                from_email=cfg.from_email or cfg.username or settings.DEFAULT_FROM_EMAIL,
                recipient_list=[test_to],
                connection=conn,
                fail_silently=False,
            )
            test_status = {"test_sent": True}
        except Exception as e:
            test_status = {"test_sent": False, "test_error": str(e)}
    else:
        test_status = {}

    resp = _sanitize(cfg)
    resp.update(test_status)
    return Response(resp, status=200)






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
@permission_classes([AllowAny])
def create_certificate(request):
    print("🧾 Données reçues :", request.data)

    # Inputs
    domain = (request.data.get('domain') or request.data.get('url') or "").strip()
    check_frequency = request.data.get('check_frequency', 'daily')
    custom_alert_days = request.data.get('custom_alert_days')
    custom_emails = request.data.get('custom_emails')
    team_id = request.data.get('team') or request.data.get('team_id')  # accepte les deux formats
    print("📌 team_id reçu :", team_id)

    # Validation basique
    if not domain:
        return Response({'error': 'Le champ "domain" est requis.'}, status=400)

    # Accepte une URL complète et extrait l’hostname
    if domain.startswith("http"):
        try:
            domain = urlparse(domain).hostname or domain
        except Exception:
            pass

    # Récupération infos SSL
    cert_info = get_ssl_info(domain)
    if not cert_info:
        return Response({'error': 'Impossible d’analyser le certificat SSL.'}, status=400)

    # Champs ajoutés/manquants
    cert_info['domain'] = domain
    cert_info['check_frequency'] = check_frequency
    cert_info['next_check_at'] = get_next_check_date(check_frequency)

    if custom_alert_days not in (None, ""):
        cert_info['custom_alert_days'] = custom_alert_days
    if custom_emails:
        cert_info['custom_emails'] = custom_emails

    # Équipe (optionnelle)
    if team_id:
        try:
            team = Team.objects.get(id=int(team_id))
            print("✅ Équipe trouvée :", team)
            cert_info['team'] = team.id  # passer l’ID au serializer
        except Team.DoesNotExist:
            print("❌ Aucune équipe trouvée avec cet ID.")
            return Response({'error': "L'équipe spécifiée est introuvable."}, status=400)
    else:
        print("⚠️ Aucune valeur 'team_id' reçue.")

    print("📦 Données envoyées au serializer :", cert_info)

    # Sauvegarde (upsert par domaine)
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

from django.db.models import ProtectedError
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status

from .models import Team
from .serializers import TeamSerializer

def _normalize_emails(s: str) -> str:
    import re
    email_re = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    seen = set()
    out = []
    for raw in (s or "").split(","):
        e = raw.strip()
        if not e:
            continue
        k = e.lower()
        if k in seen:
            continue
        if email_re.match(e):
            seen.add(k)
            out.append(e)
    return ",".join(out)

@api_view(["GET", "POST"])
@permission_classes([AllowAny])
@authentication_classes([])   # <-- pas de SessionAuthentication => pas de CSRF
def teams_list_create(request):
    if request.method == "GET":
        qs = Team.objects.all().order_by("-id")
        return Response(TeamSerializer(qs, many=True).data)

    # POST (create)
    data = request.data.copy()
    data["default_emails"] = _normalize_emails(data.get("default_emails", ""))

    ser = TeamSerializer(data=data)
    if ser.is_valid():
        obj = ser.save()
        return Response(TeamSerializer(obj).data, status=status.HTTP_201_CREATED)
    return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([AllowAny])
@authentication_classes([])   # <-- idem
def teams_detail(request, pk: int):
    team = get_object_or_404(Team, pk=pk)

    if request.method == "GET":
        return Response(TeamSerializer(team).data)

    if request.method in ("PUT", "PATCH"):
        data = request.data.copy()
        if "default_emails" in data:
            data["default_emails"] = _normalize_emails(data.get("default_emails", ""))
        partial = (request.method == "PATCH")
        ser = TeamSerializer(team, data=data, partial=partial)
        if ser.is_valid():
            obj = ser.save()
            return Response(TeamSerializer(obj).data)
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

    # DELETE
    try:
        team.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    except ProtectedError:
        return Response(
            {"detail": "Impossible de supprimer: des objets y sont rattachés."},
            status=status.HTTP_409_CONFLICT,
        )


from datetime import timedelta
from django.utils import timezone

def get_next_check_date(frequency):
    now = timezone.now()
    return {
        "1h": now + timedelta(hours=1),
        "2h": now + timedelta(hours=2),
        "4h": now + timedelta(hours=4),
        "8h": now + timedelta(hours=8),
        "12h": now + timedelta(hours=12),
        "daily": now + timedelta(days=1),
        "weekly": now + timedelta(weeks=1),
        "monthly": now + timedelta(days=30),
    }.get(frequency, now + timedelta(days=1))  # fallback


def download_cert(request, cert_id):
    from .models import Certificate
    cert = Certificate.objects.get(id=cert_id)
    domain = cert.domain

    pem_cert = ssl.get_server_certificate((domain, 443))
    response = HttpResponse(pem_cert, content_type='application/x-pem-file')
    response['Content-Disposition'] = f'attachment; filename="{domain}.crt"'
    return response

def get_private_key_path(request, cert_id):
    try:
        cert = Certificate.objects.get(id=cert_id)
        key_filename = f"{cert.domain}.key"
        key_path = f"/opt/certificats-cles-privees/{key_filename}"
        return JsonResponse({"key_path": key_path})
    except Certificate.DoesNotExist:
        return JsonResponse({"error": "Certificat introuvable"}, status=404)


from certificates.utils.free_guard import free_run_available

# certificates/views.py
@api_view(['GET'])
def plan_status(request):
    try:
        r = requests.get(
            f"{config("ENGINE_URL")}/plan/status",
            headers={"X-Engine-Token": config("ENGINE_TOKEN")},
            timeout=5,
        )
        return Response(r.json(), status=r.status_code)
    except requests.RequestException:
        return Response({"ok": False, "error": "ENGINE_DOWN"}, status=502)

