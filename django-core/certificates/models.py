from django.utils import timezone

from django.db import models


class Team(models.Model):
    name = models.CharField(max_length=100)
    default_alert_days = models.PositiveIntegerField(default=15)
    default_emails = models.TextField(help_text="Emails séparés par des virgules")

    def __str__(self):
        return self.name
    

from django.db import models

class AppEmailConfig(models.Model):
    # Singleton row (id=1)
    id = models.IntegerField(primary_key=True, default=1, editable=False)

    provider = models.CharField(max_length=50, blank=True)  # e.g. gmail/outlook (optionnel)
    host = models.CharField(max_length=200, default='smtp.gmail.com')
    port = models.PositiveIntegerField(default=587)
    username = models.CharField(max_length=200, blank=True)   # sender email
    password = models.CharField(max_length=200, blank=True)   # app password
    use_tls = models.BooleanField(default=True)
    use_ssl = models.BooleanField(default=False)
    from_email = models.CharField(max_length=200, blank=True) # display from

    def save(self, *args, **kwargs):
        self.id = 1
        if not self.from_email and self.username:
            self.from_email = self.username
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.username or '-'} @ {self.host}:{self.port}"


class Certificate_Externe(models.Model):
    certificate_id = models.IntegerField(unique=True)
    certificate_request_ref = models.CharField(max_length=100)
    certificate_target = models.CharField(max_length=50)
    certificate_state = models.CharField(max_length=50)
    common_name = models.CharField(max_length=255)
    dns = models.JSONField()  # ou TextField si tu veux stocker raw JSON
    action_at = models.DateTimeField()
    generated_at = models.DateTimeField()
    exp_date = models.DateTimeField(null=True, blank=True)
    is_renewed = models.BooleanField(default=False)
    certificate_type = models.CharField(max_length=50)
    archive_password = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField()
    actor_id = models.IntegerField()
    actor = models.CharField(max_length=100)
    applicant = models.CharField(max_length=100)
    itop_ticket_num = models.IntegerField()
    itop_ticket_ref = models.CharField(max_length=100)
    ticket_state = models.CharField(max_length=50)

    def __str__(self):
        return self.common_name

class Certificate(models.Model):
    domain = models.CharField(max_length=255, unique=False)
    cn = models.CharField(max_length=255, default='') 
    start_date = models.DateField() 
    end_date = models.DateField()
    days_remaining = models.IntegerField()
    status = models.CharField(max_length=20)
    last_checked = models.DateTimeField(auto_now=True)
    notified = models.BooleanField(default=False)  
    team = models.ForeignKey(Team, on_delete=models.SET_NULL, null=True, blank=True)
    custom_alert_days = models.PositiveIntegerField(null=True, blank=True)
    custom_emails = models.TextField(null=True, blank=True, help_text="Emails séparés par des virgules")
    next_check_at = models.DateTimeField(default=timezone.now)


    # Fréquence de vérification
    check_frequency = models.CharField(
        max_length=20,
        choices=[
            ('1h', 'Toutes'),
            ('2h', 'Toutes les 2 heures'),
            ('4h', 'Toutes les 4 heures'),
            ('8h', 'Toutes les 8 heures'),
            ('12h', 'Toutes les 12 heures'),
            ('daily', 'Quotidien'),
            ('weekly', 'Hebdomadaire'),
            ('monthly', 'Mensuel'),
        ],
        default='daily'
    )


    def __str__(self):
        return f"{self.domain} ({self.status})"
    




    



