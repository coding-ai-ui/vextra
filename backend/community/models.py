from django.conf import settings
from django.db import models, transaction


class SavedProject(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="saved_projects")
    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE, related_name="saves")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "project"], name="unique_saved_project")]
        ordering = ["-created_at"]


class Follow(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="project_follows")
    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE, related_name="followers")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "project"], name="unique_project_follow")]
        ordering = ["-created_at"]


class Comparison(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="comparison")
    project_ids = models.JSONField(default=list, blank=True)
    updated_at = models.DateTimeField(auto_now=True)


class Comment(models.Model):
    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="comments")
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.CASCADE, related_name="replies")
    body = models.TextField(max_length=2000)
    is_edited = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    is_hidden = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at", "id"]

    @transaction.atomic
    def soft_delete(self):
        self.body = ""
        self.is_deleted = True
        self.save(update_fields=["body", "is_deleted", "updated_at"])
        self.reports.filter(status="open").update(status="resolved")


class Reaction(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    comment = models.ForeignKey(Comment, on_delete=models.CASCADE, related_name="reactions")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "comment"], name="unique_comment_reaction")]


class Report(models.Model):
    comment = models.ForeignKey(Comment, on_delete=models.CASCADE, related_name="reports")
    reporter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    reason = models.CharField(max_length=500)
    status = models.CharField(max_length=20, choices=[("open", "Open"), ("dismissed", "Dismissed"), ("resolved", "Resolved")], default="open")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [models.UniqueConstraint(fields=["reporter", "comment"], name="unique_comment_report")]


class Notification(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    title = models.CharField(max_length=180)
    message = models.CharField(max_length=500)
    url = models.CharField(max_length=300)
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["user", "read"])]


class Activity(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="activities")
    verb = models.CharField(max_length=40)
    message = models.CharField(max_length=500)
    url = models.CharField(max_length=300)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]


class InboxMessage(models.Model):
    kind = models.CharField(max_length=20, choices=[("contact", "Contact"), ("feature", "Feature suggestion"), ("bug", "Bug report"), ("general", "General feedback")])
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    name = models.CharField(max_length=120)
    email = models.EmailField()
    subject = models.CharField(max_length=180, blank=True)
    message = models.TextField(max_length=5000)
    status = models.CharField(max_length=20, choices=[("open", "Open"), ("resolved", "Resolved")], default="open")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
