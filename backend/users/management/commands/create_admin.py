import os

from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model

from users.models import UserProfile, UserRole


class Command(BaseCommand):
    help = "Create or promote the initial administrator from environment-managed credentials."

    def add_arguments(self, parser):
        parser.add_argument("--email", default=os.environ.get("ADMIN_EMAIL", "talyn2007@gmail.com"))
        parser.add_argument("--password", default=os.environ.get("ADMIN_INITIAL_PASSWORD"))

    def handle(self, *args, **options):
        email = options["email"].strip().lower()
        password = options["password"]
        if not password:
            raise CommandError("Set ADMIN_INITIAL_PASSWORD in backend/.env or pass --password interactively.")
        User = get_user_model()
        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            username = email.split("@", 1)[0]
            suffix = 2
            candidate = username
            while User.objects.filter(username__iexact=candidate).exists():
                candidate = f"{username}{suffix}"
                suffix += 1
            user = User(username=candidate, email=email)
        user.set_password(password)
        user.is_active = True
        user.save()
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.role = UserRole.ADMIN
        profile.save(update_fields=["role"])
        self.stdout.write(self.style.SUCCESS(f"Administrator ready for {email}."))
