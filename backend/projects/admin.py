from django.contrib import admin
from django import forms

from .models import Project
from .serializers import ProjectSerializer


class ProjectAdminForm(forms.ModelForm):
    class Meta:
        model = Project
        fields = "__all__"

    def clean(self):
        data = super().clean()
        serializer = ProjectSerializer(instance=self.instance, data=data, partial=True)
        if not serializer.is_valid():
            for field, errors in serializer.errors.items():
                self.add_error(field if field in self.fields else None, [str(error) for error in errors])
        return data


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    form = ProjectAdminForm
    list_display = ["title", "category", "status", "organization", "expected_return", "risk_level", "featured", "is_demo", "created_at"]
    list_filter = ["status", "category", "risk_level", "featured", "is_demo"]
    search_fields = ["title", "description", "category", "organization", "location"]
    list_editable = ["featured"]
    prepopulated_fields = {"slug": ("title",)}
    readonly_fields = ["created_at", "updated_at", "funding_percentage", "is_demo"]
    fieldsets = [
        ("Project story", {"fields": ["title", "slug", "short_description", "description", "objective", "impact", "category", "image"]}),
        ("Publication and organization", {"fields": ["status", "organization", "location", "is_demo"]}),
        ("Impact and discovery", {"fields": ["impact_area", "impact_score", "tags", "sustainability", "gallery"]}),
        ("Fictional simulation assumptions", {"fields": ["funding_goal", "current_funding", "funding_percentage", "expected_return", "duration", "risk_level", "featured"]}),
        ("Record details", {"fields": ["created_at", "updated_at"]}),
    ]
