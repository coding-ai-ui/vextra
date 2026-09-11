from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from rest_framework import generics, permissions, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .models import UserRole
from .serializers import AdminUserCreateSerializer, AdminUserSerializer, LoginSerializer, RegisterSerializer, UserSerializer

User = get_user_model()


class IsAdmin(permissions.BasePermission):
    message = "Administrator access is required."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and getattr(getattr(request.user, "profile", None), "role", UserRole.USER) == UserRole.ADMIN)


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"


class RefreshView(TokenRefreshView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "patch", "options"]

    def get_object(self):
        return self.request.user


class AdminStatsView(generics.GenericAPIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        from projects.models import Project
        from projects.serializers import ProjectSerializer
        from community.models import Comment, Follow, InboxMessage, Report, SavedProject
        from investments.models import Investment

        return Response({
            "projects": Project.objects.count(),
            "users": User.objects.count(),
            "comments": Comment.objects.filter(is_deleted=False).count(),
            "reports": Report.objects.filter(status="open").count(),
            "feedback": InboxMessage.objects.filter(status="open").count(),
            "saved_projects": SavedProject.objects.count(),
            "following": Follow.objects.count(),
            "simulations": Investment.objects.count(),
            "draft_projects": Project.objects.filter(status="draft").count(),
            "recent_projects": ProjectSerializer(Project.objects.all()[:5], many=True).data,
            "recent_users": AdminUserSerializer(User.objects.order_by("-date_joined")[:5], many=True).data,
        })


class AdminUserListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAdmin]
    queryset = User.objects.order_by("-date_joined")

    def get(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        search = request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(Q(username__icontains=search) | Q(email__icontains=search) | Q(first_name__icontains=search) | Q(last_name__icontains=search))
        return Response(AdminUserSerializer(queryset, many=True).data)

    def create(self, request, *args, **kwargs):
        serializer = AdminUserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(AdminUserSerializer(serializer.save()).data, status=status.HTTP_201_CREATED)


class AdminUserDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdmin]
    queryset = User.objects.all()
    serializer_class = AdminUserSerializer

    def perform_update(self, serializer):
        from rest_framework.exceptions import ValidationError
        target = self.get_object()
        role = self.request.data.get("role")
        if role is not None and role not in UserRole.values:
            raise ValidationError({"role": "Choose either user or admin."})
        demoting = role == UserRole.USER and target.profile.role == UserRole.ADMIN
        deactivating = serializer.validated_data.get("is_active") is False
        if target.email.lower() == "talyn2007@gmail.com" and (demoting or deactivating):
            raise ValidationError({"detail": "The primary administrator account is protected."})
        if target.pk == self.request.user.pk and (demoting or deactivating):
            raise ValidationError({"detail": "You cannot revoke access from your own administrator account."})
        if (demoting or deactivating) and target.profile.role == UserRole.ADMIN and User.objects.filter(profile__role=UserRole.ADMIN, is_active=True).count() <= 1:
            raise ValidationError({"detail": "The final active administrator must retain access."})
        with transaction.atomic():
            user = serializer.save()
            if role in UserRole.values:
                user.profile.role = role
                user.profile.save(update_fields=["role"])

    def destroy(self, request, *args, **kwargs):
        target = self.get_object()
        if target.pk == request.user.pk:
            return Response({"detail": "You cannot delete your own administrator account."}, status=status.HTTP_400_BAD_REQUEST)
        if target.email.lower() == "talyn2007@gmail.com":
            return Response({"detail": "The primary administrator account is protected."}, status=status.HTTP_400_BAD_REQUEST)
        if getattr(target.profile, "role", UserRole.USER) == UserRole.ADMIN and User.objects.filter(profile__role=UserRole.ADMIN).count() <= 1:
            return Response({"detail": "The final administrator account cannot be deleted."}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)
