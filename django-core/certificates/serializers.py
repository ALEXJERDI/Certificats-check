from rest_framework import serializers
from certificates.models import Certificate, Team, SMTPConfig, ScanFrequency

class CertificateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Certificate
        fields = '__all__'


class TeamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = '__all__'


class SMTPConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = SMTPConfig
        fields = '__all__'



