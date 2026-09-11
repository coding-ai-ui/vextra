from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.db.models import BooleanField, Case, Count, Exists, ExpressionWrapper, F, FloatField, IntegerField, OuterRef, Q, Value, When
from django.db.models.deletion import ProtectedError
from django.shortcuts import get_object_or_404
from rest_framework import filters, generics, permissions
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from users.views import IsAdmin
from .models import Project
from .serializers import ProjectSerializer


def project_queryset(user=None, include_drafts=False):
    from community.models import Follow, SavedProject
    queryset = Project.objects.all()
    if not include_drafts:
        queryset = queryset.exclude(status="draft")
        if not settings.DEMO_MODE:
            queryset = queryset.filter(is_demo=False)
    queryset = queryset.annotate(
        save_count=Count("saves", distinct=True),
        comment_count=Count("comments", filter=Q(comments__is_deleted=False, comments__is_hidden=False), distinct=True),
        follow_count=Count("followers", distinct=True),
    ).annotate(popularity=F("save_count") + F("comment_count") + F("follow_count"))
    if user and user.is_authenticated:
        queryset = queryset.annotate(
            saved=Exists(SavedProject.objects.filter(project=OuterRef("pk"), user=user)),
            following=Exists(Follow.objects.filter(project=OuterRef("pk"), user=user)),
        )
    else:
        queryset = queryset.annotate(saved=Value(False, output_field=BooleanField()), following=Value(False, output_field=BooleanField()))
    return queryset


class PublicReadAdminWrite(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.method in permissions.SAFE_METHODS or IsAdmin().has_permission(request, view)


class ProjectListCreateView(generics.ListCreateAPIView):
    serializer_class = ProjectSerializer
    permission_classes = [PublicReadAdminWrite]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["title", "category", "description", "short_description", "tags", "organization", "location", "impact_area"]
    ordering_fields = ["title", "expected_return", "created_at", "duration", "funding_percentage", "popularity", "impact_score"]

    def get_queryset(self):
        admin = self.request.query_params.get("admin", "").lower() in ("true", "1")
        if admin and not IsAdmin().has_permission(self.request, self):
            raise PermissionDenied("Administrator access is required.")
        queryset = project_queryset(self.request.user, include_drafts=admin)
        search = self.request.query_params.get("search", "").strip()
        if search and not self.request.query_params.get("ordering"):
            queryset = queryset.annotate(relevance=Case(
                When(title__iexact=search, then=Value(5)),
                When(title__icontains=search, then=Value(4)),
                When(organization__icontains=search, then=Value(3)),
                When(tags__icontains=search, then=Value(2)),
                When(category__icontains=search, then=Value(1)),
                default=Value(0), output_field=IntegerField(),
            )).order_by("-relevance", "-featured", "-created_at", "id")
        if "funding_percentage" in self.request.query_params.get("ordering", ""):
            queryset = queryset.alias(funding_percentage=ExpressionWrapper(F("current_funding") * 100.0 / F("funding_goal"), output_field=FloatField()))
        for field in ("category", "risk_level", "location", "impact_area", "status"):
            value = self.request.query_params.get(field, "").strip()
            if value:
                queryset = queryset.filter(**{f"{field}__iexact": value})
        for parameter, lookup in (("return_min", "expected_return__gte"), ("return_max", "expected_return__lte")):
            value = self.request.query_params.get(parameter, "").strip()
            if value:
                try:
                    parsed = Decimal(value)
                    if not parsed.is_finite() or not 0 <= parsed <= 100:
                        raise InvalidOperation
                except InvalidOperation:
                    raise ValidationError({parameter: "Enter a return between 0 and 100."})
                queryset = queryset.filter(**{lookup: parsed})
        featured = self.request.query_params.get("featured", "").lower()
        if featured in {"true", "1", "false", "0"}:
            queryset = queryset.filter(featured=featured in {"true", "1"})
        return queryset


class ProjectDetailView(generics.RetrieveAPIView):
    serializer_class = ProjectSerializer
    permission_classes = [permissions.AllowAny]

    def get_object(self):
        lookup = self.kwargs["lookup"]
        return get_object_or_404(project_queryset(self.request.user), **({"pk": int(lookup)} if lookup.isdecimal() else {"slug": lookup}))


class AdminProjectDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ProjectSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        return project_queryset(self.request.user, include_drafts=True)

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response({"detail": "This project belongs to saved simulations. Set its status to completed to preserve portfolio history."}, status=409)
