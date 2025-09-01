
# Register your models here.
from django.contrib import admin
from .models import Certificate, Team, SMTPConfig, ScanFrequency


@admin.register(Certificate)
class CertificateAdmin(admin.ModelAdmin):
    list_display = ('domain', 'status', 'end_date', 'team', 'notified', 'last_checked')
    list_filter = ('status', 'team', 'notified')
    search_fields = ('domain', 'cn')


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ('name', 'alert_days')
    search_fields = ('name',)


@admin.register(SMTPConfig)
class SMTPConfigAdmin(admin.ModelAdmin):
    list_display = ('host', 'port', 'sender_email', 'use_tls', 'use_ssl')


@admin.register(ScanFrequency)
class ScanFrequencyAdmin(admin.ModelAdmin):
    list_display = ('label', 'interval_minutes')
