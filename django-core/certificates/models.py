from django.db import models


class Team(models.Model):
    name = models.CharField(max_length=100)
    default_alert_days = models.PositiveIntegerField(default=15)
    default_emails = models.TextField(help_text="Emails séparés par des virgules")

    def __str__(self):
        return self.name



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

    # Fréquence de vérification
    check_frequency = models.CharField(
        max_length=20,
        choices=[
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
    

class SmtpConfiguration(models.Model):
    name = models.CharField(max_length=100, default="Configuration SMTP principale")
    host = models.CharField(max_length=255)
    port = models.PositiveIntegerField()
    email_host_user = models.EmailField()
    email_host_password = models.CharField(max_length=255)
    use_tls = models.BooleanField(default=True)
    use_ssl = models.BooleanField(default=False)
    active = models.BooleanField(default=True)

    def __str__(self):
        return f"SMTP ({self.email_host_user})"


    



