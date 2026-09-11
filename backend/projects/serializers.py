from rest_framework import serializers
from community.validation import plain_text, safe_url, text_list
from .models import Project


class ProjectSerializer(serializers.ModelSerializer):
    funding_percentage = serializers.DecimalField(max_digits=5, decimal_places=1, read_only=True)
    saved = serializers.SerializerMethodField()
    following = serializers.SerializerMethodField()
    save_count = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()
    popularity = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Project
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at", "is_demo"]
        extra_kwargs = {"description": {"max_length": 20000}, "objective": {"max_length": 5000}, "impact": {"max_length": 5000}}

    def get_saved(self, obj):
        if hasattr(obj, "saved"):
            return obj.saved
        user = getattr(self.context.get("request"), "user", None)
        return bool(user and user.is_authenticated and obj.saves.filter(user=user).exists())

    def get_following(self, obj):
        if hasattr(obj, "following"):
            return obj.following
        user = getattr(self.context.get("request"), "user", None)
        return bool(user and user.is_authenticated and obj.followers.filter(user=user).exists())

    def get_save_count(self, obj):
        return obj.save_count if hasattr(obj, "save_count") else obj.saves.count()

    def get_comment_count(self, obj):
        return obj.comment_count if hasattr(obj, "comment_count") else obj.comments.filter(is_deleted=False, is_hidden=False).count()

    def validate(self, attrs):
        for name in ("title", "short_description", "description", "objective", "impact", "category", "organization", "location", "impact_area"):
            if name in attrs:
                attrs[name] = plain_text(attrs[name])
        return attrs

    def validate_tags(self, value):
        return text_list(value)

    def validate_sustainability(self, value):
        return text_list(value)

    def validate_gallery(self, value):
        if not isinstance(value, list) or len(value) > 8 or not all(isinstance(item, str) for item in value):
            raise serializers.ValidationError("Provide up to 8 image URLs.")
        return [safe_url(item) for item in value]

    def validate_image(self, value):
        return safe_url(value) if value else value

    def validate_slug(self, value):
        if value.isdecimal():
            raise serializers.ValidationError("Include a letter in the project slug.")
        return value
