from django.contrib.auth import get_user_model
from django.conf import settings
from django.db.models.signals import pre_delete, pre_save, post_save
from django.dispatch import receiver
from django.utils import timezone

from projects.models import Project
from .models import Comment, Follow, Report
from .services import notify


@receiver(pre_delete, sender=get_user_model())
def preserve_conversations_on_account_deletion(sender, instance, **kwargs):
    comments = Comment.objects.filter(author=instance)
    Report.objects.filter(comment__in=comments, status="open").update(status="resolved")
    comments.update(body="", is_deleted=True, updated_at=timezone.now())


@receiver(pre_save, sender=Project)
def remember_project(sender, instance, **kwargs):
    instance._previous = sender.objects.filter(pk=instance.pk).values().first() if instance.pk else None


@receiver(post_save, sender=Project)
def project_updates(sender, instance, created, raw=False, **kwargs):
    if raw or instance.status == "draft" or (instance.is_demo and not settings.DEMO_MODE):
        return
    previous = getattr(instance, "_previous", None)
    url = f"/projects/{instance.slug}"
    published = created or (previous and previous["status"] == "draft")
    recipients = set()
    if previous:
        tracked = ("title", "description", "short_description", "objective", "impact", "organization", "location", "status", "impact_area", "impact_score", "tags", "gallery", "sustainability", "expected_return", "current_funding", "funding_goal", "duration", "featured", "risk_level", "image")
        if any(previous[field] != sender._meta.get_field(field).to_python(getattr(instance, field)) for field in tracked):
            title = "Project updated"
            message = f"{instance.title} has new project information."
            if previous["status"] != instance.status:
                title, message = "Project status changed", f"{instance.title} is now {instance.get_status_display().lower()}."
            elif not previous["featured"] and instance.featured:
                title, message = "A project you follow is featured", f"Explore the latest from {instance.title}."
            for follow in Follow.objects.filter(project=instance).select_related("user__profile"):
                recipients.add(follow.user_id)
                notify(follow.user, title, message, url, "notify_projects")
    if published:
        topics = {str(value).casefold() for value in [instance.category, instance.impact_area, *instance.tags] if value}
        for user in get_user_model().objects.filter(is_active=True, profile__notify_projects=True).select_related("profile"):
            if user.pk not in recipients and topics.intersection(str(value).casefold() for value in user.profile.interests):
                notify(user, "A new project for your interests", f"Discover {instance.title} in {instance.category}.", url, "notify_projects")
