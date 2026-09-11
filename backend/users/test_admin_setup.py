from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command, CommandError
from rest_framework.test import APITestCase

from .models import UserRole

User = get_user_model()


class AdminSetupTests(APITestCase):
    email = "owner@example.test"
    password = "Forest-sky-setup-84!"

    def setup_admin(self, **options):
        output = StringIO()
        call_command("create_admin", email=self.email, password=self.password,
                     if_missing=True, stdout=output, **options)
        self.assertNotIn(self.password, output.getvalue())

    def test_new_administrator_can_log_in_and_access_admin_api(self):
        self.setup_admin()
        response = self.client.post("/api/users/login/", {"username": self.email, "password": self.password})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["user"]["role"], UserRole.ADMIN)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
        self.assertEqual(self.client.get("/api/users/admin/stats/").status_code, 200)

    def test_repeat_deploy_preserves_changed_password_role_and_inactive_status(self):
        self.setup_admin()
        user = User.objects.get(email=self.email)
        user.set_password("Changed-after-setup-63!")
        user.is_active = False
        user.save()
        user.profile.role = UserRole.USER
        user.profile.save()
        saved_hash = user.password
        self.setup_admin()
        user.refresh_from_db()
        self.assertEqual(user.password, saved_hash)
        self.assertFalse(user.is_active)
        self.assertEqual(user.profile.role, UserRole.USER)
        self.assertEqual(User.objects.filter(email=self.email).count(), 1)

    def test_existing_regular_account_is_not_promoted_or_reset(self):
        user = User.objects.create_user("existing", self.email.upper(), "Existing-forest-69!")
        saved_hash = user.password
        self.setup_admin()
        user.refresh_from_db()
        self.assertEqual(user.password, saved_hash)
        self.assertEqual(user.profile.role, UserRole.USER)

    def test_invalid_settings_do_not_create_an_account(self):
        for email, password in ((self.email, ""), (self.email, "12345678"), ("invalid-email", self.password)):
            with self.subTest(email=email), self.assertRaises(CommandError):
                call_command("create_admin", email=email, password=password, if_missing=True, stdout=StringIO())
        self.assertEqual(User.objects.count(), 0)

    def test_username_collision_keeps_the_other_account(self):
        other = User.objects.create_user("owner", "another@example.test", "Existing-forest-69!")
        self.setup_admin()
        self.assertEqual(User.objects.get(email=self.email).username, "owner2")
        other.refresh_from_db()
        self.assertEqual(other.profile.role, UserRole.USER)
