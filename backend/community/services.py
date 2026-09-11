from .models import Activity, Notification


def activity(user, verb, message, url):
    return Activity.objects.create(user=user, verb=verb, message=message[:500], url=url)


def notify(user, title, message, url, preference):
    if user.is_active and getattr(user.profile, preference, False):
        return Notification.objects.create(user=user, title=title[:180], message=message[:500], url=url)
