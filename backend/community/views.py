from django.db import transaction
from django.db.models import BooleanField, Count, Exists, OuterRef, Prefetch, Q, Value
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from users.views import IsAdmin
from .models import Activity, Comment, Comparison, Follow, InboxMessage, Notification, Reaction, Report, SavedProject
from .serializers import ActivitySerializer, CommentSerializer, ComparisonSerializer, InboxSerializer, NotificationSerializer, ReportSerializer
from .services import activity, notify
from .validation import plain_text


def comment_queryset(user=None):
    queryset = Comment.objects.select_related("author__profile", "project", "parent__parent").annotate(
        reaction_count=Count("reactions", distinct=True),
        reply_count=Count("replies", filter=Q(replies__is_deleted=False, replies__is_hidden=False), distinct=True),
        report_count=Count("reports", filter=Q(reports__status="open"), distinct=True),
    )
    if user and user.is_authenticated:
        return queryset.annotate(reacted=Exists(Reaction.objects.filter(comment=OuterRef("pk"), user=user)))
    return queryset.annotate(reacted=Value(False, output_field=BooleanField()))


def public_project(request, pk):
    from projects.views import project_queryset
    return get_object_or_404(project_queryset(request.user), pk=pk)


def public_comments(user):
    from projects.views import project_queryset
    return comment_queryset(user).filter(project_id__in=project_queryset(user).values("pk"))


class ProjectRelationshipView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    model = SavedProject
    label = "saved"

    @transaction.atomic
    def post(self, request, pk):
        project = public_project(request, pk)
        _, created = self.model.objects.get_or_create(user=request.user, project=project)
        if created:
            activity(request.user, self.label, f"You {'saved' if self.label == 'saved' else 'followed'} {project.title}", f"/projects/{project.slug}")
        return Response({self.label: True, "save_count": project.saves.count()})

    @transaction.atomic
    def delete(self, request, pk):
        from projects.models import Project
        project = get_object_or_404(Project, pk=pk)
        removed, _ = self.model.objects.filter(user=request.user, project=project).delete()
        if removed:
            activity(request.user, f"un{self.label}", f"You {'removed from saved projects:' if self.label == 'saved' else 'unfollowed'} {project.title}", f"/projects/{project.slug}")
        return Response({self.label: False})


class SaveProjectView(ProjectRelationshipView):
    pass


class FollowProjectView(ProjectRelationshipView):
    model = Follow
    label = "following"


class SavedListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    relationship = "saves"

    def get_serializer_class(self):
        from projects.serializers import ProjectSerializer
        return ProjectSerializer

    def get_queryset(self):
        from projects.views import project_queryset
        return project_queryset(self.request.user).filter(**{f"{self.relationship}__user": self.request.user}).order_by(f"-{self.relationship}__created_at")


class FollowingListView(SavedListView):
    relationship = "followers"


class ComparisonView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def projects(self, request, ids):
        from projects.views import project_queryset
        from projects.serializers import ProjectSerializer
        available = {project.pk: project for project in project_queryset(request.user).filter(pk__in=ids)}
        ordered = [available[pk] for pk in ids if pk in available]
        return ProjectSerializer(ordered, many=True, context={"request": request}).data

    def get(self, request):
        comparison = Comparison.objects.filter(user=request.user).first()
        if comparison is None:
            return Response([])
        projects = self.projects(request, comparison.project_ids)
        visible_ids = [project["id"] for project in projects]
        if visible_ids != comparison.project_ids:
            # Conditional update prevents a stale read from overwriting a newer selection.
            Comparison.objects.filter(pk=comparison.pk, project_ids=comparison.project_ids).update(project_ids=visible_ids)
        return Response(projects)

    @transaction.atomic
    def put(self, request):
        serializer = ComparisonSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        ids = serializer.validated_data["project_ids"]
        Comparison.objects.update_or_create(user=request.user, defaults={"project_ids": ids})
        return Response(self.projects(request, ids))


class ProjectCommentListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    serializer_class = CommentSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "comment"

    def get_throttles(self):
        return super().get_throttles() if self.request.method == "POST" else []

    def get_queryset(self):
        return comment_queryset(self.request.user).filter(project=public_project(self.request, self.kwargs["pk"]))

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "project": public_project(self.request, self.kwargs["pk"])}

    @transaction.atomic
    def perform_create(self, serializer):
        project = serializer.context["project"]
        comment = serializer.save(project=project, author=self.request.user)
        url = f"/projects/{project.slug}#comment-{comment.pk}"
        activity(self.request.user, "commented", f"You commented on {project.title}", url)
        if comment.parent and comment.parent.author_id and comment.parent.author_id != self.request.user.pk:
            notify(comment.parent.author, "A new reply to your comment", f"{self.request.user.get_full_name() or self.request.user.username} replied on {project.title}.", url, "notify_replies")


class CommentDetailView(generics.UpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CommentSerializer
    http_method_names = ["patch", "delete", "options"]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "comment"

    def get_queryset(self):
        return public_comments(self.request.user).filter(author=self.request.user, is_deleted=False, is_hidden=False)

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "project": self.get_object().project}

    def perform_update(self, serializer):
        serializer.save(is_edited=True)

    def delete(self, request, pk):
        comment = self.get_object()
        comment.soft_delete()
        return Response(status=204)


class CommentReactionView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "reaction"

    @transaction.atomic
    def post(self, request, pk):
        comment = get_object_or_404(public_comments(request.user), pk=pk, is_deleted=False, is_hidden=False)
        _, created = Reaction.objects.get_or_create(user=request.user, comment=comment)
        if created and comment.author_id and comment.author_id != request.user.pk:
            notify(comment.author, "Your comment was useful", f"{request.user.get_full_name() or request.user.username} found your comment on {comment.project.title} useful.", f"/projects/{comment.project.slug}#comment-{comment.pk}", "notify_reactions")
        return Response({"reacted": True, "reaction_count": comment.reactions.count()})

    def delete(self, request, pk):
        comment = get_object_or_404(public_comments(request.user), pk=pk)
        Reaction.objects.filter(user=request.user, comment=comment).delete()
        return Response({"reacted": False, "reaction_count": comment.reactions.count()})


class CommentReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "report"

    def post(self, request, pk):
        comment = get_object_or_404(public_comments(request.user), pk=pk, is_deleted=False, is_hidden=False)
        reason = request.data.get("reason")
        if not isinstance(reason, str) or not reason.strip() or len(reason) > 500:
            raise ValidationError({"reason": "Explain the issue in 1–500 characters."})
        reason = plain_text(reason)
        report, created = Report.objects.get_or_create(comment=comment, reporter=request.user, defaults={"reason": reason})
        return Response({"id": report.pk, "detail": "Report submitted for administrator review."}, status=201 if created else 200)


class MyCommentsView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CommentSerializer

    def get_queryset(self):
        return public_comments(self.request.user).filter(author=self.request.user, is_deleted=False, is_hidden=False).order_by("-created_at")


class NotificationsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        queryset = Notification.objects.filter(user=request.user)
        return Response({"results": NotificationSerializer(queryset, many=True).data, "unread_count": queryset.filter(read=False).count()})


class NotificationDetailView(generics.UpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = NotificationSerializer
    http_method_names = ["patch", "options"]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)


class NotificationsReadAllView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        count = Notification.objects.filter(user=request.user, read=False).update(read=True)
        return Response({"updated": count, "unread_count": 0})


class ActivityView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ActivitySerializer

    def get_queryset(self):
        return Activity.objects.filter(user=self.request.user)[:100]


class ContactView(generics.CreateAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = InboxSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "contact"
    kind = "contact"

    def perform_create(self, serializer):
        if self.kind == "contact" and not serializer.validated_data.get("subject", "").strip():
            raise ValidationError({"subject": "Enter a subject."})
        kind = self.kind or serializer.validated_data.get("kind")
        if kind not in ("contact", "feature", "bug", "general") or (self.kind is None and kind == "contact"):
            raise ValidationError({"kind": "Choose feature, bug or general."})
        serializer.save(kind=kind, user=self.request.user if self.request.user.is_authenticated else None)


class FeedbackView(ContactView):
    kind = None


class AdminCommentsView(generics.ListAPIView):
    permission_classes = [IsAdmin]
    serializer_class = CommentSerializer

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "moderation": True}

    def get_queryset(self):
        queryset = comment_queryset(self.request.user).order_by("-created_at")
        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(Q(body__icontains=search) | Q(author__username__icontains=search) | Q(project__title__icontains=search))
        for key, field in (("project", "project_id"), ("user", "author_id")):
            value = self.request.query_params.get(key, "")
            if value:
                if not value.isdecimal():
                    raise ValidationError({key: "Enter a valid ID."})
                queryset = queryset.filter(**{field: value})
        status = self.request.query_params.get("status")
        if status == "hidden":
            queryset = queryset.filter(is_hidden=True)
        elif status == "reported":
            queryset = queryset.filter(report_count__gt=0)
        elif status == "deleted":
            queryset = queryset.filter(is_deleted=True)
        return queryset


class AdminCommentDetailView(APIView):
    permission_classes = [IsAdmin]

    def patch(self, request, pk):
        comment = get_object_or_404(Comment, pk=pk, is_deleted=False)
        hidden = request.data.get("is_hidden")
        if not isinstance(hidden, bool):
            raise ValidationError({"is_hidden": "Choose true or false."})
        comment.is_hidden = hidden
        comment.save(update_fields=["is_hidden", "updated_at"])
        if hidden:
            comment.reports.filter(status="open").update(status="resolved")
        return Response(CommentSerializer(comment_queryset(request.user).get(pk=pk), context={"moderation": True}).data)

    def delete(self, request, pk):
        comment = get_object_or_404(Comment, pk=pk)
        comment.soft_delete()
        return Response(status=204)


class AdminReportsView(generics.ListAPIView):
    permission_classes = [IsAdmin]
    serializer_class = ReportSerializer

    def get_queryset(self):
        queryset = Report.objects.select_related("reporter__profile").prefetch_related(Prefetch("comment", queryset=comment_queryset(self.request.user)))
        status = self.request.query_params.get("status", "open")
        return queryset.filter(status=status) if status in ("open", "dismissed", "resolved") else queryset

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "moderation": True}


class AdminReportDismissView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        report = get_object_or_404(Report, pk=pk)
        report.status = "dismissed"
        report.save(update_fields=["status"])
        return Response({"id": report.pk, "status": report.status})


class AdminFeedbackView(generics.ListAPIView):
    permission_classes = [IsAdmin]
    serializer_class = InboxSerializer

    def get_queryset(self):
        queryset = InboxMessage.objects.all()
        for field in ("kind", "status"):
            value = self.request.query_params.get(field)
            if value and value != "all":
                queryset = queryset.filter(**{field: value})
        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(Q(name__icontains=search) | Q(email__icontains=search) | Q(subject__icontains=search) | Q(message__icontains=search))
        return queryset


class AdminFeedbackDetailView(APIView):
    permission_classes = [IsAdmin]

    def patch(self, request, pk):
        item = get_object_or_404(InboxMessage, pk=pk)
        if request.data.get("status") not in ("open", "resolved"):
            raise ValidationError({"status": "Choose open or resolved."})
        item.status = request.data["status"]
        item.save(update_fields=["status"])
        return Response(InboxSerializer(item).data)
