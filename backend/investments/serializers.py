from decimal import Decimal

from rest_framework import serializers

from projects.models import Project
from projects.serializers import ProjectSerializer
from .models import Investment


class InvestmentSerializer(serializers.ModelSerializer):
    project = ProjectSerializer(read_only=True)
    project_id = serializers.PrimaryKeyRelatedField(queryset=Project.objects.exclude(status="draft"), source="project", write_only=True)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    estimated_total = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = Investment
        fields = ["id", "project", "project_id", "amount", "expected_profit", "expected_return_snapshot", "estimated_total", "created_at"]
        read_only_fields = ["id", "expected_profit", "expected_return_snapshot", "estimated_total", "created_at"]

    def validate_project_id(self, value):
        from django.conf import settings
        if value.is_demo and not settings.DEMO_MODE:
            raise serializers.ValidationError("This demonstration project is unavailable.")
        if self.instance and value.pk != self.instance.project_id:
            raise serializers.ValidationError("A saved allocation cannot be moved to another project.")
        return value

    def to_representation(self, instance):
        from django.conf import settings
        from users.models import UserRole
        data = super().to_representation(instance)
        user = getattr(self.context.get("request"), "user", None)
        admin = user and user.is_authenticated and getattr(user.profile, "role", None) == UserRole.ADMIN
        if not admin and (instance.project.status == "draft" or (instance.project.is_demo and not settings.DEMO_MODE)):
            # Preserve the owner's amount/rate/history without exposing unpublished edits.
            data["project"] = {"id": instance.project_id, "slug": str(instance.project_id), "title": "Project currently unavailable", "category": "Unavailable", "status": "draft", "unavailable": True, "impact_score": None, "impact_area": "Unavailable", "image": None}
        return data
