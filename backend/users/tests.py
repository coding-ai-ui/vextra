from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from .models import UserRole

User = get_user_model()


class AuthenticationTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user("river", "river@example.com", "Explore-forest-47!")

    def setUp(self):
        cache.clear()

    def test_registration_hashes_password_and_exposes_only_public_fields(self):
        response = self.client.post("/api/users/register/", {
            "username": "marin", "email": "MARIN@example.com", "password": "Calm-green-planet-48!",
        })
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(set(response.data), {"id", "username", "email"})
        created = User.objects.get(username="marin")
        self.assertEqual(created.email, "marin@example.com")
        self.assertNotEqual(created.password, "Calm-green-planet-48!")
        self.assertTrue(created.check_password("Calm-green-planet-48!"))
        self.assertFalse(created.is_staff)

    def test_registration_validates_required_fields_and_password_strength(self):
        self.assertEqual(self.client.post("/api/users/register/", {}).status_code, 400)
        response = self.client.post("/api/users/register/", {
            "username": "marin", "email": "not-an-email", "password": "123",
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.data)
        response = self.client.post("/api/users/register/", {
            "username": "marin", "email": "marin@example.com", "password": "12345678",
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn("password", response.data)
        whitespace = self.client.post("/api/users/register/", {
            "username": "marin", "email": "marin@example.com", "password": "          ",
        })
        self.assertEqual(whitespace.status_code, 400)
        self.assertIn("password", whitespace.data)

    def test_registration_rejects_case_insensitive_duplicate_identifiers(self):
        for values, field in [
            ({"username": "RIVER", "email": "new@example.com"}, "username"),
            ({"username": "new", "email": "RIVER@example.com"}, "email"),
        ]:
            with self.subTest(field=field):
                response = self.client.post("/api/users/register/", {
                    **values, "password": "Calm-green-planet-48!",
                })
                self.assertEqual(response.status_code, 400)
                self.assertIn(field, response.data)

    def test_login_accepts_username_or_email_and_me_is_private(self):
        self.assertEqual(self.client.get("/api/users/me/").status_code, 401)
        for identifier in ("river", "RIVER@example.com"):
            with self.subTest(identifier=identifier):
                response = self.client.post("/api/users/login/", {
                    "username": identifier, "password": "Explore-forest-47!",
                })
                self.assertEqual(response.status_code, 200, response.data)
                self.assertTrue(response.data["access"])
                self.assertTrue(response.data["refresh"])
                self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
                me = self.client.get("/api/users/me/")
                self.assertEqual(me.status_code, 200)
                self.assertEqual({key: me.data[key] for key in ("id", "username", "email", "first_name", "last_name", "role")}, {"id": self.user.id, "username": "river", "email": "river@example.com", "first_name": "", "last_name": "", "role": "user"})
                self.assertEqual(me.data["counts"], {"saved": 0, "following": 0, "comments": 0, "simulations": 0})
                self.assertNotIn("password", me.data)

    def test_invalid_credentials_and_inactive_user_cannot_sign_in(self):
        self.assertEqual(self.client.post("/api/users/login/", {
            "username": "river", "password": "incorrect",
        }).status_code, 401)
        self.user.is_active = False
        self.user.save(update_fields=["is_active"])
        self.assertEqual(self.client.post("/api/users/login/", {
            "username": "river", "password": "Explore-forest-47!",
        }).status_code, 401)

    def test_expired_access_is_rejected_but_refresh_restores_access(self):
        refresh = RefreshToken.for_user(self.user)
        expired = refresh.access_token
        expired.set_exp(lifetime=timedelta(seconds=-1))
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {expired}")
        self.assertEqual(self.client.get("/api/users/me/").status_code, 401)
        response = self.client.post("/api/users/refresh/", {"refresh": str(refresh)})
        self.assertEqual(response.status_code, 200, response.data)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
        self.assertEqual(self.client.get("/api/users/me/").status_code, 200)

    def test_refresh_rotates_and_rejects_reuse(self):
        old = str(RefreshToken.for_user(self.user))
        response = self.client.post("/api/users/refresh/", {"refresh": old})
        self.assertEqual(response.status_code, 200)
        self.assertNotEqual(response.data["refresh"], old)
        self.assertEqual(self.client.post("/api/users/refresh/", {"refresh": old}).status_code, 401)
        self.assertEqual(self.client.post("/api/users/refresh/", {"refresh": response.data["refresh"]}).status_code, 200)

    def test_expired_malformed_and_access_tokens_cannot_refresh(self):
        expired = RefreshToken.for_user(self.user)
        expired.set_exp(lifetime=timedelta(seconds=-1))
        for token in (str(expired), "not-a-jwt", str(AccessToken.for_user(self.user))):
            with self.subTest(token_type=token[:12]):
                self.assertEqual(self.client.post("/api/users/refresh/", {"refresh": token}).status_code, 401)

    def test_inactive_user_cannot_use_previously_issued_tokens(self):
        refresh = RefreshToken.for_user(self.user)
        self.user.is_active = False
        self.user.save(update_fields=["is_active"])
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
        self.assertEqual(self.client.get("/api/users/me/").status_code, 401)
        self.assertEqual(self.client.post("/api/users/refresh/", {"refresh": str(refresh)}).status_code, 401)

    def test_admin_endpoints_require_stored_admin_role(self):
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.get("/api/users/admin/stats/").status_code, 403)
        self.assertEqual(self.client.get("/api/users/admin/users/").status_code, 403)
        self.user.profile.role = UserRole.ADMIN
        self.user.profile.save(update_fields=["role"])
        self.assertEqual(self.client.get("/api/users/admin/stats/").status_code, 200)

    def test_admin_user_creation_hashes_password_and_primary_admin_cannot_be_deleted(self):
        self.user.profile.role = UserRole.ADMIN
        self.user.profile.save(update_fields=["role"])
        self.client.force_authenticate(self.user)
        response = self.client.post("/api/users/admin/users/", {
            "full_name": "New Curator", "email": "curator@example.com", "password": "Curator-green-47!", "role": "user",
        })
        self.assertEqual(response.status_code, 201, response.data)
        created = User.objects.get(email="curator@example.com")
        self.assertTrue(created.check_password("Curator-green-47!"))
        self.assertEqual(response.data["role"], "user")
