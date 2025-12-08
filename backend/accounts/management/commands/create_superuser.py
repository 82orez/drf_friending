from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
import os

User = get_user_model()


class Command(BaseCommand):
    help = "Create a superuser if one does not exist"

    def handle(self, *args, **options):
        # username = os.environ.get("DJANGO_SUPERUSER_USERNAME", "admin")
        email = os.environ.get("DJANGO_SUPERUSER_EMAIL", "admin@example.com")
        password = os.environ.get("DJANGO_SUPERUSER_PASSWORD", "admin123")

        if not User.objects.filter(email=email).exists():
            User.objects.create_superuser(
                email=email, password=password
            )
            self.stdout.write(
                self.style.SUCCESS(f'Superuser "{email}" created successfully')
            )
        else:
            self.stdout.write(
                self.style.WARNING(f'Superuser "{email}" already exists')
            )
