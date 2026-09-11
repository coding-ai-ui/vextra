import logging
from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import permissions, serializers
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken


class ResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)


class ResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField(max_length=100)
    token = serializers.CharField(max_length=200)
    password = serializers.CharField(max_length=128, trim_whitespace=False)


class PasswordResetView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"

    def post(self, request):
        data = ResetRequestSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        user = get_user_model().objects.filter(email__iexact=data.validated_data["email"], is_active=True).first()
        if user and user.has_usable_password():
            link = f"{settings.FRONTEND_URL}/reset-password?{urlencode({'uid': urlsafe_base64_encode(force_bytes(user.pk)), 'token': default_token_generator.make_token(user)})}"
            try:
                send_mail("Reset your Vextra password", f"A password reset was requested for your Vextra account.\n\nOpen this link within one hour:\n{link}\n\nIf you did not request this change, ignore this message. Your password remains unchanged.", settings.DEFAULT_FROM_EMAIL, [user.email])
            except (OSError, ValueError):
                logging.getLogger(__name__).error("Password reset email delivery failed. Check email configuration.")
        return Response({"detail": "If an active account matches that email, a password reset link has been sent."})


class PasswordResetConfirmView(PasswordResetView):
    def post(self, request):
        data = ResetConfirmSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        try:
            uid = force_str(urlsafe_base64_decode(data.validated_data["uid"]))
            user = get_user_model().objects.get(pk=uid, is_active=True)
        except (ValueError, TypeError, OverflowError, UnicodeDecodeError, get_user_model().DoesNotExist):
            user = None
        if user is None or not default_token_generator.check_token(user, data.validated_data["token"]):
            raise serializers.ValidationError({"detail": "This reset link is invalid or expired. Request a new link."})
        try:
            validate_password(data.validated_data["password"], user)
            if not data.validated_data["password"].strip():
                raise DjangoValidationError("Choose a password containing a non-space character.")
        except DjangoValidationError as error:
            raise serializers.ValidationError({"password": error.messages})
        user.set_password(data.validated_data["password"])
        user.save(update_fields=["password"])
        for token in OutstandingToken.objects.filter(user=user):
            BlacklistedToken.objects.get_or_create(token=token)
        return Response({"detail": "Your password has been reset. Log in with your new password."})
