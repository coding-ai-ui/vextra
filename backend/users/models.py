from django.db import models

class UserRole(models.TextChoices):
	USER = "user", "User"
	ADMIN = "admin", "Admin"


class UserProfile(models.Model):
	user = models.OneToOneField("auth.User", on_delete=models.CASCADE, related_name="profile")
	role = models.CharField(max_length=20, choices=UserRole.choices, default=UserRole.USER)
	bio = models.CharField(max_length=500, blank=True)
	avatar = models.CharField(max_length=500, blank=True, default="sage")
	interests = models.JSONField(default=list, blank=True)
	notify_replies = models.BooleanField(default=True)
	notify_reactions = models.BooleanField(default=True)
	notify_projects = models.BooleanField(default=True)
