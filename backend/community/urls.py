from django.urls import path
from . import views

urlpatterns = [
    path("saved/", views.SavedListView.as_view()),
    path("following/", views.FollowingListView.as_view()),
    path("comparison/", views.ComparisonView.as_view()),
    path("comments/<int:pk>/", views.CommentDetailView.as_view()),
    path("comments/<int:pk>/react/", views.CommentReactionView.as_view()),
    path("comments/<int:pk>/report/", views.CommentReportView.as_view()),
    path("notifications/", views.NotificationsView.as_view()),
    path("notifications/read-all/", views.NotificationsReadAllView.as_view()),
    path("notifications/<int:pk>/", views.NotificationDetailView.as_view()),
    path("activity/", views.ActivityView.as_view()),
    path("contact/", views.ContactView.as_view()),
    path("feedback/", views.FeedbackView.as_view()),
    path("admin/comments/", views.AdminCommentsView.as_view()),
    path("admin/comments/<int:pk>/", views.AdminCommentDetailView.as_view()),
    path("admin/reports/", views.AdminReportsView.as_view()),
    path("admin/reports/<int:pk>/dismiss/", views.AdminReportDismissView.as_view()),
    path("admin/feedback/", views.AdminFeedbackView.as_view()),
    path("admin/feedback/<int:pk>/", views.AdminFeedbackDetailView.as_view()),
]
