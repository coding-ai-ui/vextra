from decimal import Decimal
from urllib.parse import parse_qs, urlparse

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from investments.models import Investment
from projects.models import Project
from .models import Activity, Comment, Comparison, Follow, InboxMessage, Notification, Reaction, Report, SavedProject

User = get_user_model()


class ExpansionTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user("reader", "reader@example.com", "Community-forest-482!")
        cls.other = User.objects.create_user("writer", "writer@example.com", "Community-water-483!")
        cls.admin = User.objects.create_user("curator", "curator@example.com", "Community-energy-484!", is_staff=True)
        cls.primary = User.objects.create_user("primary", "talyn2007@gmail.com", "Primary-community-485!", is_staff=True)
        cls.project = Project.objects.create(title="Solar Circle", description="Educational solar initiative", category="Clean Energy", funding_goal="100000", current_funding="10000", expected_return="15", duration=12, location="Lagos", impact_area="Climate", impact_score=85, organization="Circle Collective", tags=["Solar", "Community"], sustainability=["Renewable generation"])
        cls.water = Project.objects.create(title="Water Circle", description="Educational water initiative", category="Water", funding_goal="100000", expected_return="10", duration=10, impact_score=90)
        cls.draft = Project.objects.create(title="Future Circle", description="Unpublished concept", category="Water", funding_goal="50000", expected_return="8", duration=8, status="draft")

    def setUp(self):
        cache.clear()
        self.client.force_authenticate(self.user)

    def comment(self, user=None, parent=None, project=None, body="Thoughtful project. How will the pilot be evaluated?"):
        return Comment.objects.create(author=user or self.user, project=project or self.project, parent=parent, body=body)

    def test_saved_and_following_are_private_idempotent_and_persisted(self):
        for action, model, key, listing in [("save", SavedProject, "saved", "saved"), ("follow", Follow, "following", "following")]:
            endpoint = f"/api/projects/{self.project.pk}/{action}/"
            for _ in range(2):
                self.assertTrue(self.client.post(endpoint).data[key])
            self.assertEqual(model.objects.filter(user=self.user, project=self.project).count(), 1)
            response = self.client.get(f"/api/community/{listing}/")
            self.assertEqual([item["id"] for item in response.data], [self.project.pk])
            self.assertTrue(response.data[0][key])
            self.client.force_authenticate(self.other)
            self.assertEqual(self.client.get(f"/api/community/{listing}/").data, [])
            self.client.force_authenticate(self.user)
            self.assertFalse(self.client.delete(endpoint).data[key])
            self.assertEqual(model.objects.filter(user=self.user).count(), 0)
        self.assertEqual(Activity.objects.filter(user=self.user).count(), 4)

    def test_comparison_is_persisted_ordered_and_isolated_between_accounts(self):
        endpoint = "/api/community/comparison/"
        self.assertEqual(self.client.get(endpoint).data, [])
        ids = [self.water.pk, self.project.pk]
        response = self.client.put(endpoint, {"project_ids": ids, "user": self.other.pk})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual([project["id"] for project in response.data], ids)
        self.assertEqual(Comparison.objects.get(user=self.user).project_ids, ids)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(endpoint).data, [])
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(endpoint).status_code, 401)
        self.assertEqual(self.client.put(endpoint, {"project_ids": []}).status_code, 401)
        self.client.force_authenticate(self.user)
        self.assertEqual([project["id"] for project in self.client.get(endpoint).data], ids)
        self.assertEqual(self.client.put(endpoint, {"project_ids": []}).data, [])
        self.assertEqual(Comparison.objects.get(user=self.user).project_ids, [])

    def test_comparison_rejects_invalid_ids_without_overwriting_saved_selection(self):
        endpoint = "/api/community/comparison/"
        original = [self.project.pk]
        self.client.put(endpoint, {"project_ids": original})
        invalid = [None, "1", [True], [1.5], ["1"], [-1], [0], [self.draft.pk], [99999], [self.project.pk] * 2, [1, 2, 3, 4, 5]]
        for ids in invalid:
            with self.subTest(ids=ids):
                self.assertEqual(self.client.put(endpoint, {"project_ids": ids}).status_code, 400)
                self.assertEqual(Comparison.objects.get(user=self.user).project_ids, original)
        self.assertEqual(self.client.put(endpoint, {}).status_code, 400)

    def test_comparison_accepts_four_distinct_published_projects(self):
        extra = [Project.objects.create(title=f"Comparison {number}", description="A published initiative", category="Water", funding_goal="10000", expected_return="5", duration=6) for number in range(2)]
        ids = [self.project.pk, extra[0].pk, self.water.pk, extra[1].pk]
        response = self.client.put("/api/community/comparison/", {"project_ids": ids})
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in response.data], ids)

    def test_comparison_reconciles_unpublished_and_deleted_projects(self):
        endpoint = "/api/community/comparison/"
        self.client.put(endpoint, {"project_ids": [self.water.pk, self.project.pk]})
        self.water.status = "draft"
        self.water.save()
        self.assertEqual([item["id"] for item in self.client.get(endpoint).data], [self.project.pk])
        self.assertEqual(Comparison.objects.get(user=self.user).project_ids, [self.project.pk])
        self.project.delete()
        self.assertEqual(self.client.get(endpoint).data, [])
        self.assertEqual(Comparison.objects.get(user=self.user).project_ids, [])

    @override_settings(DEMO_MODE=False)
    def test_hidden_demo_data_is_omitted_from_comparisons_counts_and_notifications(self):
        SavedProject.objects.create(user=self.user, project=self.project)
        Follow.objects.create(user=self.user, project=self.project)
        self.comment()
        Comparison.objects.create(user=self.user, project_ids=[self.project.pk])
        self.project.is_demo = True
        self.project.save()
        self.assertEqual(self.client.get("/api/community/comparison/").data, [])
        self.assertEqual(self.client.put("/api/community/comparison/", {"project_ids": [self.project.pk]}).status_code, 400)
        self.assertEqual(self.client.get("/api/users/me/").data["counts"], {"saved": 0, "following": 0, "comments": 0, "simulations": 0})
        self.assertEqual(self.client.get("/api/users/me/comments/").data, [])
        self.assertFalse(Notification.objects.filter(user=self.user).exists())

    def test_account_deletion_preserves_other_authors_replies_and_resolves_reports(self):
        root = self.comment(user=self.other)
        child = self.comment(parent=root, body="Please preserve this reply.")
        report = Report.objects.create(comment=root, reporter=self.user, reason="Review before deletion")
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.delete(f"/api/users/admin/users/{self.other.pk}/").status_code, 204)
        root.refresh_from_db()
        child.refresh_from_db()
        report.refresh_from_db()
        self.assertIsNone(root.author_id)
        self.assertEqual(root.body, "")
        self.assertTrue(root.is_deleted)
        self.assertEqual(child.author_id, self.user.pk)
        self.assertEqual(child.parent_id, root.pk)
        self.assertEqual(child.body, "Please preserve this reply.")
        self.assertEqual(report.status, "resolved")
        self.client.force_authenticate(None)
        data = self.client.get(f"/api/projects/{self.project.pk}/comments/").data
        self.assertIsNone(data[0]["author"])
        self.assertEqual(data[1]["body"], child.body)

    def test_report_counts_are_private_read_only_and_author_deletion_resolves_reports(self):
        endpoint = f"/api/projects/{self.project.pk}/comments/"
        result = self.client.post(endpoint, {"body": "A useful question", "report_count": 8, "reaction_count": 100, "author": {"id": self.other.pk}})
        self.assertEqual(result.status_code, 201)
        self.assertNotIn("report_count", result.data)
        self.assertEqual(result.data["reaction_count"], 0)
        comment = Comment.objects.get(pk=result.data["id"])
        self.assertEqual(comment.author_id, self.user.pk)
        report = Report.objects.create(comment=comment, reporter=self.other, reason="Please review")
        self.assertNotIn("report_count", self.client.get(endpoint).data[0])
        self.assertEqual(self.client.delete(f"/api/community/comments/{comment.pk}/").status_code, 204)
        report.refresh_from_db()
        self.assertEqual(report.status, "resolved")

    def test_unpublished_projects_keep_private_history_without_leaking_draft_content(self):
        created = self.client.post("/api/investments/", {"project_id": self.project.pk, "amount": "1000"})
        comment = self.comment()
        SavedProject.objects.create(user=self.user, project=self.project)
        Follow.objects.create(user=self.user, project=self.project)
        self.project.status = "draft"
        self.project.title = "Confidential unpublished title"
        self.project.description = "Private unpublished content"
        self.project.save()
        portfolio = self.client.get("/api/investments/").data
        self.assertEqual(portfolio[0]["estimated_total"], "1150.00")
        self.assertTrue(portfolio[0]["project"]["unavailable"])
        self.assertNotIn("description", portfolio[0]["project"])
        self.assertNotIn("Confidential", str(portfolio))
        self.assertEqual(self.client.get("/api/users/me/").data["counts"], {"saved": 0, "following": 0, "comments": 0, "simulations": 1})
        for endpoint in (f"/api/community/comments/{comment.pk}/react/", f"/api/community/comments/{comment.pk}/report/"):
            self.assertEqual(self.client.post(endpoint, {"reason": "No private access"}).status_code, 404)
        self.assertEqual(self.client.patch(f"/api/community/comments/{comment.pk}/", {"body": "No private edits"}).status_code, 404)
        self.assertEqual(self.client.get(f"/api/projects/{self.project.pk}/comments/").status_code, 404)
        self.assertEqual(self.client.get("/api/users/me/comments/").data, [])
        self.assertEqual(self.client.patch(f"/api/investments/{created.data['id']}/", {"amount": "500"}).data["expected_profit"], "75.00")

    def test_profile_and_inbox_boundaries_are_validated_before_database_writes(self):
        for field, value in (("first_name", "x" * 151), ("last_name", "x" * 151), ("bio", "x" * 501), ("avatar", "https://user:secret@example.com/avatar.jpg"), ("interests", ["valid", 7])):
            self.assertEqual(self.client.patch("/api/users/me/", {field: value}).status_code, 400, field)
        payload = {"name": "Visitor", "email": "visitor@example.com", "subject": "Question", "message": "x" * 5001}
        self.assertEqual(self.client.post("/api/community/contact/", payload).status_code, 400)
        self.assertFalse(InboxMessage.objects.exists())

    def test_comments_are_public_plain_text_and_owner_edits_only(self):
        endpoint = f"/api/projects/{self.project.pk}/comments/"
        created = self.client.post(endpoint, {"body": "An interesting approach to local energy."})
        self.assertEqual(created.status_code, 201, created.data)
        comment_url = f"/api/community/comments/{created.data['id']}/"
        self.client.force_authenticate(None)
        self.assertEqual(len(self.client.get(endpoint).data), 1)
        self.assertEqual(self.client.post(endpoint, {"body": "Anonymous"}).status_code, 401)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.patch(comment_url, {"body": "Hijacked"}).status_code, 404)
        self.assertEqual(self.client.delete(comment_url).status_code, 404)
        self.client.force_authenticate(self.user)
        edited = self.client.patch(comment_url, {"body": "Updated question about the pilot."})
        self.assertEqual(edited.status_code, 200)
        self.assertTrue(edited.data["is_edited"])
        for body in ("", " ", "x" * 2001, "<script>alert(1)</script>", "<img src=x onerror=alert(1)>"):
            self.assertEqual(self.client.post(endpoint, {"body": body}).status_code, 400)

    def test_nested_replies_validate_project_depth_and_preserve_deleted_thread(self):
        root = self.comment(user=self.other)
        endpoint = f"/api/projects/{self.project.pk}/comments/"
        child = self.client.post(endpoint, {"body": "First reply", "parent": root.pk})
        grandchild = self.client.post(endpoint, {"body": "Second level", "parent": child.data["id"]})
        self.assertEqual(grandchild.status_code, 201)
        self.assertEqual(self.client.post(endpoint, {"body": "Too deep", "parent": grandchild.data["id"]}).status_code, 400)
        self.assertEqual(self.client.post(f"/api/projects/{self.water.pk}/comments/", {"body": "Wrong project", "parent": root.pk}).status_code, 400)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.delete(f"/api/community/comments/{root.pk}/").status_code, 204)
        data = self.client.get(endpoint).data
        self.assertEqual(len(data), 3)
        self.assertTrue(data[0]["is_deleted"])
        self.assertEqual(data[0]["body"], "")
        self.assertEqual(data[0]["reply_count"], 1)

    def test_reactions_are_unique_and_notification_is_not_generated_by_reads(self):
        comment = self.comment(user=self.other)
        endpoint = f"/api/community/comments/{comment.pk}/react/"
        for _ in range(2):
            response = self.client.post(endpoint)
            self.assertEqual(response.data, {"reacted": True, "reaction_count": 1})
        self.assertEqual(Reaction.objects.count(), 1)
        self.assertEqual(Notification.objects.filter(user=self.other).count(), 1)
        for _ in range(3):
            self.client.get(f"/api/projects/{self.project.pk}/comments/")
        self.assertEqual(Notification.objects.count(), 1)
        self.assertEqual(self.client.delete(endpoint).data["reaction_count"], 0)

    def test_reply_notification_opt_out_and_private_read_controls(self):
        root = self.comment(user=self.other)
        endpoint = f"/api/projects/{self.project.pk}/comments/"
        self.client.post(endpoint, {"body": "Reply", "parent": root.pk})
        note = Notification.objects.get(user=self.other)
        self.assertEqual(self.client.get("/api/community/notifications/").data["unread_count"], 0)
        self.assertEqual(self.client.patch(f"/api/community/notifications/{note.pk}/", {"read": True}).status_code, 404)
        self.other.profile.notify_replies = False
        self.other.profile.save()
        self.client.post(endpoint, {"body": "Another reply", "parent": root.pk})
        self.assertEqual(Notification.objects.count(), 1)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get("/api/community/notifications/").data["unread_count"], 1)
        self.assertEqual(self.client.patch(f"/api/community/notifications/{note.pk}/", {"read": True}).status_code, 200)
        self.assertEqual(self.client.post("/api/community/notifications/read-all/").data["unread_count"], 0)

    def test_project_updates_and_interest_matching_trigger_real_notifications(self):
        Follow.objects.create(user=self.user, project=self.project)
        self.project.description = "An updated pilot plan"
        self.project.save()
        self.assertEqual(Notification.objects.filter(user=self.user).count(), 1)
        self.project.save()
        self.assertEqual(Notification.objects.filter(user=self.user).count(), 1)
        self.project.status = "completed"
        self.project.save()
        self.assertTrue(Notification.objects.filter(title="Project status changed").exists())
        self.other.profile.interests = ["Water"]
        self.other.profile.save()
        self.draft.description = "Still a draft"
        self.draft.save()
        self.assertFalse(Notification.objects.filter(user=self.other).exists())
        self.draft.status = "active"
        self.draft.save()
        self.assertEqual(Notification.objects.filter(user=self.other).count(), 1)
        self.user.profile.notify_projects = False
        self.user.profile.save()
        before = Notification.objects.filter(user=self.user).count()
        self.project.featured = True
        self.project.save()
        self.assertEqual(Notification.objects.filter(user=self.user).count(), before)

    def test_report_moderation_filter_hide_unhide_dismiss_and_delete(self):
        comment = self.comment(user=self.other)
        report = self.client.post(f"/api/community/comments/{comment.pk}/report/", {"reason": "Off-topic promotional content"})
        self.assertEqual(report.status_code, 201)
        self.assertEqual(self.client.post(f"/api/community/comments/{comment.pk}/report/", {"reason": "Same issue"}).status_code, 200)
        self.client.force_authenticate(self.admin)
        reports = self.client.get("/api/community/admin/reports/")
        self.assertEqual(reports.data[0]["comment"]["id"], comment.pk)
        self.assertEqual(reports.data[0]["comment"]["report_count"], 1)
        results = self.client.get(f"/api/community/admin/comments/?status=reported&project={self.project.pk}&user={self.other.pk}&search=Thoughtful")
        self.assertEqual(len(results.data), 1)
        endpoint = f"/api/community/admin/comments/{comment.pk}/"
        self.assertEqual(self.client.patch(endpoint, {"is_hidden": True}).status_code, 200)
        self.client.force_authenticate(None)
        public = self.client.get(f"/api/projects/{self.project.pk}/comments/").data[0]
        self.assertTrue(public["is_hidden"])
        self.assertEqual(public["body"], "")
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.patch(endpoint, {"is_hidden": False}).status_code, 200)
        self.assertEqual(self.client.post(f"/api/community/admin/reports/{report.data['id']}/dismiss/").data["status"], "dismissed")
        self.assertEqual(self.client.delete(endpoint).status_code, 204)
        comment.refresh_from_db()
        self.assertTrue(comment.is_deleted)

    def test_normal_user_cannot_access_any_admin_route_or_mutation(self):
        comment = self.comment()
        report = Report.objects.create(comment=comment, reporter=self.other, reason="Review")
        inbox = InboxMessage.objects.create(kind="general", name="Reader", email="reader@example.com", message="Feedback")
        for endpoint in ("/api/community/admin/comments/", "/api/community/admin/reports/", "/api/community/admin/feedback/", "/api/users/admin/users/", f"/api/users/admin/users/{self.other.pk}/", "/api/users/admin/stats/", "/api/projects/?admin=true", f"/api/projects/admin/{self.draft.pk}/"):
            self.assertEqual(self.client.get(endpoint).status_code, 403, endpoint)
        for endpoint, payload in ((f"/api/community/admin/comments/{comment.pk}/", {"is_hidden": True}), (f"/api/community/admin/feedback/{inbox.pk}/", {"status": "resolved"}), (f"/api/users/admin/users/{self.other.pk}/", {"role": "admin"}), (f"/api/projects/admin/{self.project.pk}/", {"title": "Hijack"})):
            self.assertEqual(self.client.patch(endpoint, payload).status_code, 403)
            self.assertEqual(self.client.delete(endpoint).status_code, 403)
        self.assertEqual(self.client.post(f"/api/community/admin/reports/{report.pk}/dismiss/").status_code, 403)
        self.assertEqual(self.client.post("/api/projects/", {"title": "Hijack"}).status_code, 403)

    def test_profile_edit_counts_validation_and_role_escalation_blocked(self):
        SavedProject.objects.create(user=self.user, project=self.project)
        Follow.objects.create(user=self.user, project=self.project)
        self.comment()
        Investment.objects.create(user=self.user, project=self.project, amount=Decimal("1000"))
        response = self.client.patch("/api/users/me/", {"first_name": "River", "last_name": "Park", "bio": "Learning about climate action.", "avatar": "violet", "interests": ["Clean Energy"], "notify_reactions": False, "role": "admin", "is_staff": True})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["role"], "user")
        self.assertEqual(response.data["counts"], {"saved": 1, "following": 1, "comments": 1, "simulations": 1})
        self.assertEqual(self.client.get("/api/users/me/comments/").data[0]["author"]["first_name"], "River")
        self.assertFalse(response.data["notify_reactions"])
        for field, value in (("email", "WRITER@example.com"), ("username", "WRITER"), ("avatar", "javascript:alert(1)"), ("bio", "<script>bad</script>"), ("interests", ["x"] * 13)):
            self.assertEqual(self.client.patch("/api/users/me/", {field: value}).status_code, 400)
        self.assertEqual(self.client.get("/api/community/activity/").data, [])

    def test_primary_admin_cannot_be_demoted_disabled_renamed_or_deleted(self):
        self.client.force_authenticate(self.admin)
        endpoint = f"/api/users/admin/users/{self.primary.pk}/"
        for payload in ({"role": "user"}, {"is_active": False}, {"email": "changed@example.com"}):
            self.assertEqual(self.client.patch(endpoint, payload).status_code, 400)
        self.assertEqual(self.client.delete(endpoint).status_code, 400)
        self.assertEqual(self.client.patch(f"/api/users/admin/users/{self.admin.pk}/", {"role": "user"}).status_code, 400)
        detail = self.client.get(endpoint).data
        self.assertIn("counts", detail)
        for secret in ("password", "password_hash", "is_superuser", "user_permissions"):
            self.assertNotIn(secret, detail)

    def test_admin_user_create_edit_delete_preserves_password_secrecy(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post("/api/users/admin/users/", {"full_name": "A New Member", "email": "new@example.com", "password": "New-community-482!", "role": "user"})
        self.assertEqual(response.status_code, 201)
        endpoint = f"/api/users/admin/users/{response.data['id']}/"
        self.assertNotIn("password", response.data)
        self.assertEqual(self.client.patch(endpoint, {"first_name": "Changed"}).data["first_name"], "Changed")
        self.assertEqual(self.client.delete(endpoint).status_code, 204)

    def test_drafts_are_hidden_until_publish_and_metadata_is_validated(self):
        self.assertEqual(self.client.get(f"/api/projects/{self.draft.slug}/").status_code, 404)
        self.assertNotIn(self.draft.pk, [item["id"] for item in self.client.get("/api/projects/").data])
        for action in ("save", "follow", "comments"):
            self.assertEqual(self.client.post(f"/api/projects/{self.draft.pk}/{action}/", {"body": "No draft access"}).status_code, 404)
        self.assertEqual(self.client.post("/api/investments/", {"project_id": self.draft.pk, "amount": "1000"}).status_code, 400)
        self.client.force_authenticate(self.admin)
        endpoint = f"/api/projects/admin/{self.draft.pk}/"
        self.assertEqual(self.client.get(endpoint).status_code, 200)
        for field, value in (("impact_score", 101), ("tags", "not a list"), ("gallery", ["javascript:alert(1)"]), ("sustainability", ["x" * 101]), ("slug", "123")):
            self.assertEqual(self.client.patch(endpoint, {field: value}).status_code, 400)
        self.assertEqual(self.client.patch(endpoint, {"status": "active"}).status_code, 200)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(f"/api/projects/{self.draft.slug}/").status_code, 200)
        self.assertEqual(self.client.get(f"/api/projects/{self.draft.pk}/").status_code, 200)

    def test_search_extended_filters_ordering_and_real_popularity(self):
        for query in ("search=Collective", "search=Solar", "location=Lagos", "impact_area=Climate", "return_min=14&return_max=16"):
            self.assertEqual([item["id"] for item in self.client.get(f"/api/projects/?{query}").data], [self.project.pk])
        SavedProject.objects.create(user=self.user, project=self.project)
        self.comment()
        self.assertEqual(self.client.get("/api/projects/?ordering=-popularity").data[0]["id"], self.project.pk)
        self.assertEqual(self.client.get("/api/projects/?ordering=-impact_score").data[0]["id"], self.water.pk)
        for value in ("NaN", "Infinity", "-1", "101", "hello"):
            self.assertEqual(self.client.get(f"/api/projects/?return_min={value}").status_code, 400)

    def test_allocation_history_matches_actual_changes_and_private_ownership(self):
        first = self.client.post("/api/investments/", {"project_id": self.project.pk, "amount": "1000"})
        endpoint = f"/api/investments/{first.data['id']}/"
        self.assertEqual(first.data["expected_profit"], "150.00")
        self.assertEqual(first.data["estimated_total"], "1150.00")
        self.project.expected_return = Decimal("50")
        self.project.save()
        changed = self.client.patch(endpoint, {"amount": "2000"})
        self.assertEqual(changed.data["expected_profit"], "300.00")
        self.assertEqual(self.client.patch(endpoint, {"project_id": self.water.pk}).status_code, 400)
        history = self.client.get("/api/investments/history/").data
        self.assertEqual([(item["allocated"], item["value"]) for item in history], [("0.00", "0.00"), ("1000.00", "1150.00"), ("2000.00", "2300.00")])
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get("/api/investments/history/").data, [])
        self.assertEqual(self.client.delete(endpoint).status_code, 404)
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.delete(endpoint).status_code, 204)
        self.assertEqual(self.client.get("/api/investments/history/").data[-1]["value"], "0.00")
        self.assertEqual(Activity.objects.filter(user=self.user).count(), 3)

    def test_project_with_portfolio_returns_useful_conflict_on_admin_delete(self):
        Investment.objects.create(user=self.user, project=self.project, amount=Decimal("1000"))
        self.client.force_authenticate(self.admin)
        response = self.client.delete(f"/api/projects/admin/{self.project.pk}/")
        self.assertEqual(response.status_code, 409)
        self.assertIn("completed", response.data["detail"])

    def test_contact_and_feedback_reach_admin_inbox_with_validation(self):
        self.client.force_authenticate(None)
        contact = self.client.post("/api/community/contact/", {"name": "Visitor", "email": "visitor@example.com", "subject": "A question", "message": "How is an impact score calculated?"})
        self.assertEqual(contact.status_code, 201, contact.data)
        feedback = self.client.post("/api/community/feedback/", {"kind": "feature", "name": "Visitor", "email": "visitor@example.com", "message": "Please add a learning glossary."})
        self.assertEqual(feedback.status_code, 201)
        self.assertEqual(self.client.post("/api/community/contact/", {"name": "V", "email": "invalid", "message": "Bad"}).status_code, 400)
        self.assertEqual(self.client.post("/api/community/feedback/", {"kind": "random", "name": "V", "email": "v@example.com", "message": "Bad"}).status_code, 400)
        self.client.force_authenticate(self.admin)
        self.assertEqual(len(self.client.get("/api/community/admin/feedback/").data), 2)
        self.assertEqual(self.client.patch(f"/api/community/admin/feedback/{contact.data['id']}/", {"status": "resolved"}).data["status"], "resolved")
        stats = self.client.get("/api/users/admin/stats/").data
        self.assertEqual(stats["feedback"], 1)
        self.assertIn("recent_projects", stats)

    def test_comment_spam_is_rate_limited(self):
        endpoint = f"/api/projects/{self.project.pk}/comments/"
        responses = [self.client.post(endpoint, {"body": f"Question {index}"}).status_code for index in range(16)]
        self.assertEqual(responses[:15], [201] * 15)
        self.assertEqual(responses[-1], 429)

    @override_settings(DEMO_MODE=False)
    def test_explicit_demo_mode_controls_seed_visibility(self):
        Project.objects.filter(pk=self.project.pk).update(is_demo=True)
        self.assertFalse(self.client.get("/api/config/").json()["demo_mode"])
        self.assertEqual(self.client.get(f"/api/projects/{self.project.pk}/").status_code, 404)
        self.assertEqual(self.client.post("/api/investments/", {"project_id": self.project.pk, "amount": "1000"}).status_code, 400)

    @override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
    def test_password_reset_generic_delivery_redeem_once_and_revokes_sessions(self):
        refresh = RefreshToken.for_user(self.user)
        self.client.force_authenticate(None)
        response = self.client.post("/api/users/password-reset/", {"email": self.user.email})
        missing = self.client.post("/api/users/password-reset/", {"email": "absent@example.com"})
        self.assertEqual(response.data, missing.data)
        self.assertEqual(len(mail.outbox), 1)
        self.assertNotIn("token", response.data)
        link = next(line for line in mail.outbox[0].body.splitlines() if line.startswith("http"))
        query = {key: values[0] for key, values in parse_qs(urlparse(link).query).items()}
        self.assertEqual(self.client.post("/api/users/password-reset-confirm/", {**query, "password": "123"}).status_code, 400)
        payload = {**query, "password": "Changed-community-752!"}
        self.assertEqual(self.client.post("/api/users/password-reset-confirm/", payload).status_code, 200)
        self.assertEqual(self.client.post("/api/users/password-reset-confirm/", payload).status_code, 400)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("Changed-community-752!"))
        self.assertEqual(self.client.post("/api/users/refresh/", {"refresh": str(refresh)}).status_code, 401)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
        self.assertEqual(self.client.get("/api/users/me/").status_code, 401)
