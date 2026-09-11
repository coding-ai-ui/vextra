from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from community.validation import plain_text, safe_url, text_list

from .models import UserRole

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    bio = serializers.CharField(source="profile.bio", max_length=500, required=False, allow_blank=True, validators=[plain_text])
    avatar = serializers.CharField(source="profile.avatar", max_length=500, required=False, allow_blank=True)
    interests = serializers.JSONField(source="profile.interests", required=False)
    notify_replies = serializers.BooleanField(source="profile.notify_replies", required=False)
    notify_reactions = serializers.BooleanField(source="profile.notify_reactions", required=False)
    notify_projects = serializers.BooleanField(source="profile.notify_projects", required=False)
    counts = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "role", "bio", "avatar", "interests", "notify_replies", "notify_reactions", "notify_projects", "date_joined", "counts"]
        read_only_fields = ["id", "role", "date_joined", "counts"]

    def get_counts(self, obj):
        from projects.views import project_queryset
        public_ids = project_queryset(obj).values("pk")
        return {
            "saved": obj.saved_projects.filter(project_id__in=public_ids).count(),
            "following": obj.project_follows.filter(project_id__in=public_ids).count(),
            "comments": obj.comments.filter(project_id__in=public_ids, is_deleted=False, is_hidden=False).count(),
            "simulations": obj.investments.count(),
        }

    def validate_username(self, value):
        if "@" in value:
            raise serializers.ValidationError("Use a username without an @ symbol.")
        if User.objects.filter(username__iexact=value).exclude(pk=self.instance.pk).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value

    def validate_email(self, value):
        value = value.strip().lower()
        if not value:
            raise serializers.ValidationError("Enter an email address.")
        if self.instance.email.lower() == "talyn2007@gmail.com" and value != self.instance.email.lower():
            raise serializers.ValidationError("The primary administrator email is protected.")
        if User.objects.filter(email__iexact=value).exclude(pk=self.instance.pk).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate_avatar(self, value):
        return value if value in ("", "sage", "forest", "violet", "clay", "amber") else safe_url(value)

    def validate_interests(self, value):
        return text_list(value, maximum=12)

    def validate_first_name(self, value):
        return plain_text(value)

    def validate_last_name(self, value):
        return plain_text(value)

    @transaction.atomic
    def update(self, instance, validated_data):
        profile_data = validated_data.pop("profile", {})
        instance = super().update(instance, validated_data)
        for field, value in profile_data.items():
            setattr(instance.profile, field, value)
        if profile_data:
            instance.profile.save(update_fields=list(profile_data))
        return instance

    def get_role(self, obj):
        return getattr(getattr(obj, "profile", None), "role", UserRole.USER)


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=128)
    email = serializers.EmailField(required=True, max_length=254)

    class Meta:
        model = User
        fields = ["id", "username", "email", "password"]
        read_only_fields = ["id"]

    def validate_username(self, value):
        value = value.strip()
        if "@" in value:
            raise serializers.ValidationError("Use a username without an @ symbol.")
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate(self, attrs):
        if not attrs["password"].strip():
            raise serializers.ValidationError({"password": "Your password must include a non-space character."})
        candidate = User(username=attrs["username"], email=attrs["email"])
        try:
            validate_password(attrs["password"], candidate)
        except DjangoValidationError as error:
            raise serializers.ValidationError({"password": list(error.messages)})
        return attrs

    def create(self, validated_data):
        try:
            with transaction.atomic():
                return User.objects.create_user(**validated_data)
        except IntegrityError:
            raise serializers.ValidationError({"username": "This username is already taken."})


class LoginSerializer(TokenObtainPairSerializer):
    """The username input also accepts a case-insensitive email address."""

    def validate(self, attrs):
        identifier = attrs["username"].strip()
        lookup = {"email__iexact": identifier} if "@" in identifier else {"username__iexact": identifier}
        matched_user = User.objects.filter(**lookup).first()
        if matched_user:
            attrs["username"] = matched_user.username
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data


class AdminUserSerializer(UserSerializer):
    full_name = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "full_name", "role", "date_joined", "is_active", "bio", "avatar", "counts"]
        read_only_fields = ["id", "username", "full_name", "date_joined"]

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username

    def get_role(self, obj):
        return getattr(getattr(obj, "profile", None), "role", UserRole.USER)

class AdminUserCreateSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=150, validators=[plain_text])
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(write_only=True, max_length=128, trim_whitespace=False)
    role = serializers.ChoiceField(choices=UserRole.choices, default=UserRole.USER)

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate_password(self, value):
        if not value.strip():
            raise serializers.ValidationError("Password must include a non-space character.")
        try:
            validate_password(value)
        except DjangoValidationError as error:
            raise serializers.ValidationError(list(error.messages))
        return value

    @transaction.atomic
    def create(self, validated_data):
        full_name = validated_data.pop("full_name").strip()
        first_name, _, last_name = full_name.partition(" ")
        base_username = validated_data["email"].split("@", 1)[0].lower()
        username = base_username
        suffix = 2
        while User.objects.filter(username__iexact=username).exists():
            username = f"{base_username}{suffix}"
            suffix += 1
        user = User.objects.create_user(
            username=username,
            email=validated_data["email"],
            password=validated_data["password"],
            first_name=first_name,
            last_name=last_name,
        )
        user.profile.role = validated_data["role"]
        user.profile.save(update_fields=["role"])
        return user
