import os

from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import transaction

from users.models import UserProfile, UserRole


class Command(BaseCommand):
    help = "Create or promote the initial administrator from environment-managed credentials."

    def add_arguments(self, parser):
        parser.add_argument("--email", default=os.environ.get("ADMIN_EMAIL", "talyn2007@gmail.com"))
        parser.add_argument("--password", default=os.environ.get("ADMIN_INITIAL_PASSWORD"))
        parser.add_argument("--if-missing", action="store_true", help="Create a new account only; never change an existing account.")

    @transaction.atomic
    def handle(self, *args, **options):
        email = options["email"].strip().lower()
        password = options["password"]
        User = get_user_model()
        user = User.objects.filter(email__iexact=email).first()
        if user is not None and options["if_missing"]:
            self.stdout.write("Administrator setup skipped: the email already has an account; credentials and permissions are unchanged.")
            return
        if not password:
            raise CommandError("Set ADMIN_INITIAL_PASSWORD in the environment before creating the administrator.")
        try:
            validate_email(email)
        except ValidationError as exc:
            raise CommandError("ADMIN_EMAIL must be a valid email address.") from exc
        if user is None:
            username = email.split("@", 1)[0]
            suffix = 2
            candidate = username
            while User.objects.filter(username__iexact=candidate).exists():
                candidate = f"{username}{suffix}"
                suffix += 1
            user = User(username=candidate, email=email)
        try:
            validate_password(password, user=user)
        except ValidationError as exc:
            raise CommandError("ADMIN_INITIAL_PASSWORD does not meet the password requirements: " + " ".join(exc.messages)) from exc
        user.set_password(password)
        user.is_active = True
        user.save()
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.role = UserRole.ADMIN
        profile.save(update_fields=["role"])
        self.stdout.write(self.style.SUCCESS(f"Administrator ready for {email}."))
