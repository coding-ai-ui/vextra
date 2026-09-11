from django.urls import path
from community.views import MyCommentsView
from .password_reset import PasswordResetConfirmView, PasswordResetView

from .views import AdminStatsView, AdminUserDetailView, AdminUserListCreateView, LoginView, MeView, RefreshView, RegisterView

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    path("refresh/", RefreshView.as_view(), name="refresh"),
    path("me/", MeView.as_view(), name="me"),
    path("me/comments/", MyCommentsView.as_view()),
    path("password-reset/", PasswordResetView.as_view()),
    path("password-reset-confirm/", PasswordResetConfirmView.as_view()),
    path("admin/stats/", AdminStatsView.as_view(), name="admin-stats"),
    path("admin/users/", AdminUserListCreateView.as_view(), name="admin-users"),
    path("admin/users/<int:pk>/", AdminUserDetailView.as_view(), name="admin-user-detail"),
]
