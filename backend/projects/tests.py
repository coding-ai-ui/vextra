from decimal import Decimal
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.forms.models import model_to_dict
from rest_framework.test import APITestCase

from .models import Project


class ProjectTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.nova = Project.objects.create(
            title="Nova Energy", description="Community rooftop solar", category="Clean Energy",
            funding_goal=Decimal("100000"), current_funding=Decimal("72500"),
            expected_return=Decimal("15"), duration=12, risk_level="Medium", featured=True,
        )
        cls.water = Project.objects.create(
            title="AquaLoop", description="Community water reuse", category="Water",
            funding_goal=Decimal("85000"), current_funding=Decimal("66300"),
            expected_return=Decimal("10.5"), duration=10, risk_level="Low",
        )
        cls.user = get_user_model().objects.create_user("visitor", password="Solar-community-53!")
        cls.admin = get_user_model().objects.create_user("curator", password="Water-community-54!", is_staff=True)

    def test_list_and_detail_are_public_and_money_is_decimal_text(self):
        response = self.client.get("/api/projects/")
        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.data, list)
        self.assertEqual(len(response.data), 2)
        detail = self.client.get(f"/api/projects/{self.nova.id}/")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.data["expected_return"], "15.00")
        self.assertEqual(detail.data["funding_percentage"], "72.5")
        self.assertEqual(detail.data["slug"], "nova-energy")
        self.assertEqual(self.client.get("/api/projects/99999/").status_code, 404)

    def test_search_filters_and_featured_can_be_combined(self):
        for query in ("search=rooftop", "category=clean%20energy", "risk_level=medium", "featured=true", "search=solar&category=Clean%20Energy&risk_level=Medium"):
            with self.subTest(query=query):
                response = self.client.get(f"/api/projects/?{query}")
                self.assertEqual([item["id"] for item in response.data], [self.nova.id])
        self.assertEqual(self.client.get("/api/projects/?search=missing").data, [])
        self.assertEqual(self.client.get("/api/projects/?featured=false").data[0]["id"], self.water.id)

    def test_allowed_ordering_and_funding_percentage(self):
        for ordering, expected in (
            ("-expected_return", [self.nova.id, self.water.id]),
            ("title", [self.water.id, self.nova.id]),
            ("duration", [self.water.id, self.nova.id]),
            ("-funding_percentage", [self.water.id, self.nova.id]),
        ):
            with self.subTest(ordering=ordering):
                response = self.client.get(f"/api/projects/?ordering={ordering}")
                self.assertEqual(response.status_code, 200)
                self.assertEqual([item["id"] for item in response.data], expected)

    def test_only_staff_can_create_and_values_are_validated(self):
        payload = {
            "title": "New fictional project", "description": "Educational concept", "category": "Education",
            "funding_goal": "10000.00", "expected_return": "8.50", "duration": 8, "risk_level": "Low",
        }
        self.assertEqual(self.client.post("/api/projects/", payload).status_code, 401)
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.post("/api/projects/", payload).status_code, 403)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.post("/api/projects/", payload).status_code, 201)
        for field, value in (("funding_goal", "0"), ("current_funding", "-1"), ("expected_return", "101"), ("duration", 0), ("risk_level", "Certain")):
            with self.subTest(field=field):
                response = self.client.post("/api/projects/", {**payload, field: value})
                self.assertEqual(response.status_code, 400)
                self.assertIn(field, response.data)

    def test_funding_display_is_clamped(self):
        self.nova.current_funding = Decimal("250000")
        self.nova.save()
        self.assertEqual(self.client.get(f"/api/projects/{self.nova.id}/").data["funding_percentage"], "100.0")

    def test_seed_is_idempotent_and_preserves_existing_project_ids(self):
        call_command("seed_projects", stdout=StringIO())
        ids = list(Project.objects.order_by("id").values_list("id", flat=True))
        call_command("seed_projects", stdout=StringIO())
        self.assertEqual(Project.objects.count(), 10)
        self.assertEqual(list(Project.objects.order_by("id").values_list("id", flat=True)), ids)
        self.nova.refresh_from_db()
        self.assertEqual(self.nova.expected_return, Decimal("15"))
        self.assertTrue(all(project.objective and project.impact and len(project.description) > 300 for project in Project.objects.all()))

    def test_cors_is_explicit_for_local_frontend(self):
        local = self.client.get("/api/projects/", HTTP_ORIGIN="http://localhost:5173")
        self.assertEqual(local.headers.get("Access-Control-Allow-Origin"), "http://localhost:5173")
        external = self.client.get("/api/projects/", HTTP_ORIGIN="https://unrelated.example")
        self.assertNotIn("Access-Control-Allow-Origin", external.headers)

    def test_django_admin_edits_expansion_metadata_and_validates_publication_data(self):
        from .admin import ProjectAdminForm
        payload = model_to_dict(self.nova)
        payload.update(status="draft", organization="Solar Collective", location="Lagos", impact_area="Climate", impact_score=87, tags='["Solar"]', sustainability='["Renewable energy"]', gallery='[]')
        form = ProjectAdminForm(data=payload, instance=self.nova)
        self.assertTrue(form.is_valid(), form.errors)
        form.save()
        self.assertEqual(self.client.get(f"/api/projects/{self.nova.pk}/").status_code, 404)
        payload["status"] = "active"
        form = ProjectAdminForm(data=payload, instance=self.nova)
        self.assertTrue(form.is_valid(), form.errors)
        form.save()
        self.assertEqual(self.client.get(f"/api/projects/{self.nova.pk}/").data["organization"], "Solar Collective")
        for field, value in (("tags", '["<script>unsafe</script>"]'), ("gallery", '["javascript:alert(1)"]'), ("slug", "123")):
            invalid = ProjectAdminForm(data={**payload, field: value}, instance=self.nova)
            self.assertFalse(invalid.is_valid(), field)
            self.assertIn(field, invalid.errors)
