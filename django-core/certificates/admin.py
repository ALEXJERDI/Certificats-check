from django.contrib import admin
from .models import Team, Certificate

@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ('name', 'default_alert_days', 'default_emails')
    search_fields = ('name',)

@admin.register(Certificate)
class CertificateAdmin(admin.ModelAdmin):
    list_display = ('domain', 'status', 'end_date', 'team', 'check_frequency')
    list_filter = ('status', 'team')

