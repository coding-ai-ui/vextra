from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from projects.models import Project
from .models import Investment


class InvestmentTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = get_user_model().objects.create_user("marin", password="Explore-community-76!")
        cls.other = get_user_model().objects.create_user("alex", password="Explore-community-77!")
        cls.project = Project.objects.create(
            title="Nova Energy", description="Fictional solar initiative", category="Clean Energy",
            funding_goal=Decimal("100000"), current_funding=Decimal("72500"),
            expected_return=Decimal("15"), duration=12, risk_level="Medium",
        )

    def setUp(self):
        self.client.force_authenticate(self.user)

    def test_save_calculates_authoritative_profit_and_ignores_client_owned_fields(self):
        response = self.client.post("/api/investments/", {
            "project_id": self.project.id, "amount": "1000.00", "user": self.other.id,
            "expected_profit": "999999.00", "expected_return_snapshot": "99.00", "estimated_total": "999999.00",
        })
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["expected_profit"], "150.00")
        self.assertEqual(response.data["expected_return_snapshot"], "15.00")
        self.assertEqual(response.data["estimated_total"], "1150.00")
        self.assertEqual(response.data["project"]["id"], self.project.id)
        self.assertNotIn("user", response.data)
        self.assertNotIn("project_id", response.data)
        saved = Investment.objects.get(pk=response.data["id"])
        self.assertEqual(saved.user, self.user)
        self.project.refresh_from_db()
        self.assertEqual(self.project.current_funding, Decimal("72500"))

    def test_decimal_rounding_uses_half_up_at_cent_boundaries(self):
        response = self.client.post("/api/investments/", {"project_id": self.project.id, "amount": "0.10"})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["expected_profit"], "0.02")
        self.assertEqual(response.data["estimated_total"], "0.12")

    def test_invalid_amounts_are_rejected_without_creating_records(self):
        for amount in ("0", "-1", "0.001", "NaN", "Infinity", "abc", "10000000000", None):
            with self.subTest(amount=amount):
                response = self.client.post("/api/investments/", {"project_id": self.project.id, "amount": amount})
                self.assertEqual(response.status_code, 400)
                self.assertIn("amount", response.data)
        self.assertEqual(Investment.objects.count(), 0)

    def test_missing_amount_and_invalid_project_are_rejected(self):
        self.assertEqual(self.client.post("/api/investments/", {"project_id": self.project.id}).status_code, 400)
        self.assertEqual(self.client.post("/api/investments/", {"project_id": 99999, "amount": "1000"}).status_code, 400)

    def test_portfolios_are_isolated_and_remain_private(self):
        self.client.post("/api/investments/", {"project_id": self.project.id, "amount": "1000"})
        self.assertEqual(len(self.client.get("/api/investments/").data), 1)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(f"/api/investments/?user={self.user.id}").data, [])
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get("/api/investments/").status_code, 401)
        self.assertEqual(self.client.post("/api/investments/", {"project_id": self.project.id, "amount": "1000"}).status_code, 401)

    def test_saved_return_snapshot_survives_project_changes(self):
        first = self.client.post("/api/investments/", {"project_id": self.project.id, "amount": "1000"})
        self.project.expected_return = Decimal("20")
        self.project.save()
        second = self.client.post("/api/investments/", {"project_id": self.project.id, "amount": "1000"})
        stored = Investment.objects.get(pk=first.data["id"])
        self.assertEqual(stored.expected_return_snapshot, Decimal("15"))
        self.assertEqual(stored.expected_profit, Decimal("150"))
        self.assertEqual(second.data["expected_profit"], "200.00")
        self.assertEqual(sum(item.estimated_total for item in Investment.objects.all()), Decimal("2350"))

    def test_allocation_update_is_owner_only_and_retains_original_rate(self):
        response = self.client.post("/api/investments/", {"project_id": self.project.id, "amount": "1000"})
        self.assertEqual(self.client.patch("/api/investments/", {"amount": "999"}).status_code, 405)
        self.project.expected_return = Decimal("99")
        self.project.save()
        endpoint = f"/api/investments/{response.data['id']}/"
        changed = self.client.patch(endpoint, {"amount": "500"})
        self.assertEqual(changed.status_code, 200)
        self.assertEqual(changed.data["expected_profit"], "75.00")
        self.assertEqual(changed.data["expected_return_snapshot"], "15.00")
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.patch(endpoint, {"amount": "999"}).status_code, 404)
        self.assertEqual(self.client.delete(endpoint).status_code, 404)
