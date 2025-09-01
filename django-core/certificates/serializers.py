from rest_framework import serializers
from certificates.models import Certificate, Team


class CertificateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Certificate
        fields = '__all__'


class TeamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = ["id", "name", "default_alert_days", "default_emails"]



