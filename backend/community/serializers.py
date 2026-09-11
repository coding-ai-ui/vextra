from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Activity, Comment, InboxMessage, Notification, Report
from .validation import plain_text


class AuthorSerializer(serializers.ModelSerializer):
    avatar = serializers.CharField(source="profile.avatar", read_only=True, default="sage")

    class Meta:
        model = get_user_model()
        fields = ["id", "username", "first_name", "last_name", "avatar"]


class ComparisonSerializer(serializers.Serializer):
    project_ids = serializers.JSONField()

    def validate_project_ids(self, value):
        if not isinstance(value, list) or len(value) > 4 or any(type(item) is not int or item <= 0 for item in value):
            raise serializers.ValidationError("Choose up to four projects using their numeric IDs.")
        if len(set(value)) != len(value):
            raise serializers.ValidationError("Choose each project only once.")
        from projects.views import project_queryset
        visible = set(project_queryset(self.context["request"].user).filter(pk__in=value).values_list("pk", flat=True))
        if set(value) != visible:
            raise serializers.ValidationError("One or more projects are no longer available. Refresh your comparison.")
        return value


class CommentSerializer(serializers.ModelSerializer):
    author = AuthorSerializer(read_only=True)
    project_title = serializers.CharField(source="project.title", read_only=True)
    project_slug = serializers.CharField(source="project.slug", read_only=True)
    reaction_count = serializers.IntegerField(read_only=True, default=0)
    reply_count = serializers.IntegerField(read_only=True, default=0)
    report_count = serializers.IntegerField(read_only=True, default=0)
    reacted = serializers.BooleanField(read_only=True, default=False)
    body = serializers.CharField(max_length=2000, validators=[plain_text])

    class Meta:
        model = Comment
        fields = ["id", "project", "project_title", "project_slug", "parent", "author", "body", "created_at", "updated_at", "is_edited", "is_deleted", "is_hidden", "reaction_count", "reacted", "reply_count", "report_count"]
        read_only_fields = ["id", "project", "created_at", "updated_at", "is_edited", "is_deleted", "is_hidden"]

    def validate_parent(self, parent):
        if self.instance and parent != self.instance.parent:
            raise serializers.ValidationError("A comment cannot be moved to another thread.")
        if parent:
            if parent.project_id != self.context["project"].pk:
                raise serializers.ValidationError("Reply to a comment on this project.")
            if parent.is_hidden or parent.is_deleted:
                raise serializers.ValidationError("This comment is unavailable for new replies.")
            if parent.parent_id and parent.parent.parent_id:
                raise serializers.ValidationError("Replies can be nested up to two levels. Reply higher in the conversation.")
        return parent

    def to_representation(self, instance):
        result = super().to_representation(instance)
        if instance.is_deleted or (instance.is_hidden and not self.context.get("moderation")):
            result["body"] = ""
        if not self.context.get("moderation"):
            result.pop("report_count", None)
        return result


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "title", "message", "url", "read", "created_at"]
        read_only_fields = ["id", "title", "message", "url", "created_at"]


class ActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Activity
        fields = ["id", "verb", "message", "url", "created_at"]


class ReportSerializer(serializers.ModelSerializer):
    comment = CommentSerializer(read_only=True)
    reporter = AuthorSerializer(read_only=True)

    class Meta:
        model = Report
        fields = ["id", "comment", "reporter", "reason", "status", "created_at"]


class InboxSerializer(serializers.ModelSerializer):
    class Meta:
        model = InboxMessage
        fields = ["id", "kind", "name", "email", "subject", "message", "status", "created_at"]
        read_only_fields = ["id", "status", "created_at"]
        extra_kwargs = {"message": {"max_length": 5000}, "kind": {"required": False}}

    def validate(self, attrs):
        for field in ("name", "subject", "message"):
            if field in attrs:
                attrs[field] = plain_text(attrs[field])
        return attrs
