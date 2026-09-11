from django.contrib import admin
from .models import Activity, Comment, Comparison, Follow, InboxMessage, Notification, Reaction, Report, SavedProject


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ["id", "project", "author", "is_hidden", "is_deleted", "created_at"]
    list_filter = ["is_hidden", "is_deleted", "project"]
    search_fields = ["body", "author__username", "project__title"]


@admin.register(InboxMessage)
class InboxAdmin(admin.ModelAdmin):
    list_display = ["name", "kind", "subject", "status", "created_at"]
    list_filter = ["status", "kind"]
    search_fields = ["name", "email", "message", "subject"]


@admin.register(Comparison)
class ComparisonAdmin(admin.ModelAdmin):
    list_display = ["user", "updated_at"]
    search_fields = ["user__username", "user__email"]
    readonly_fields = ["user", "project_ids", "updated_at"]

    def has_add_permission(self, request):
        return False


admin.site.register([SavedProject, Follow, Reaction, Report, Notification, Activity])
