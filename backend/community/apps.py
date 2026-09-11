from django.apps import AppConfig


class CommunityConfig(AppConfig):
    name = "community"

    def ready(self):
        from . import signals  # noqa: F401
