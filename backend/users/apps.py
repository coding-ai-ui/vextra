from django.apps import AppConfig


class UsersConfig(AppConfig):
    name = "users"

    def ready(self):
        from django.contrib.auth.models import User
        from django.db.models.signals import post_save
        from .models import UserProfile

        def create_profile(sender, instance, created, **kwargs):
            if created:
                UserProfile.objects.get_or_create(user=instance, defaults={"role": "admin" if instance.is_staff else "user"})

        post_save.connect(create_profile, sender=User, dispatch_uid="users.create_profile", weak=False)
