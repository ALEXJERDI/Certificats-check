# certificates/urls.py

from django.urls import path
from .views import create_certificate, email_config, list_certificates, teams_detail, teams_list_create, download_cert, get_private_key_path, plan_status


urlpatterns = [
    path('certificates/', create_certificate),         # ✅ garde seulement "certificates/"
    path('certificates/list/', list_certificates),     # ✅ idem ici
     path("teams/", teams_list_create, name="teams-list-create"),   # GET, POST
    path("teams/<int:pk>/", teams_detail, name="teams-detail"),    # GET, PUT/PATCH, DELETE

    # urls.py 
    path("certificates/download/<int:cert_id>/", download_cert, name="download_cert"),
    # urls.py
    path("private-key/<int:cert_id>/", get_private_key_path),
    path('plan/status/', plan_status, name='plan-status'),
    path("email/config/", email_config, name="email-config"),




]
