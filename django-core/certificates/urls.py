# certificates/urls.py

from django.urls import path
from .views import create_certificate, list_certificates

urlpatterns = [
    path('certificates/', create_certificate),         # ✅ garde seulement "certificates/"
    path('certificates/list/', list_certificates),     # ✅ idem ici
]
