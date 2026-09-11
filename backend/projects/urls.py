from django.urls import path
from community.views import FollowProjectView, ProjectCommentListCreateView, SaveProjectView
from .views import AdminProjectDetailView, ProjectDetailView, ProjectListCreateView


urlpatterns = [
    path("", ProjectListCreateView.as_view(), name="project-list"),
    path("admin/<int:pk>/", AdminProjectDetailView.as_view(), name="admin-project-detail"),
    path("<int:pk>/save/", SaveProjectView.as_view()),
    path("<int:pk>/follow/", FollowProjectView.as_view()),
    path("<int:pk>/comments/", ProjectCommentListCreateView.as_view()),
    path("<str:lookup>/", ProjectDetailView.as_view(), name="project-detail"),
]
