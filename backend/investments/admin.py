from django.contrib import admin

from .models import Investment


@admin.register(Investment)
class InvestmentAdmin(admin.ModelAdmin):
    list_display = ["user", "project", "amount", "expected_profit", "expected_return_snapshot", "created_at"]
    list_filter = ["project__category", "created_at"]
    search_fields = ["user__username", "user__email", "project__title"]
    readonly_fields = ["user", "project", "amount", "expected_profit", "expected_return_snapshot", "estimated_total", "created_at"]
    list_select_related = ["user", "project"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
