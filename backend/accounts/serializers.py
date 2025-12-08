from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from .models import User


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["email", "password", "password_confirm"]

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError("Passwords don't match.")
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        user = User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
        )
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()

    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password")

        if email and password:
            # 먼저 해당 이메일로 등록된 사용자가 있는지 확인
            try:
                user = User.objects.get(email=email)
            except User.DoesNotExist:
                raise serializers.ValidationError(
                    "We couldn't find an account with this email address."
                )

            # 사용자가 존재하면 비밀번호 확인
            user = authenticate(
                request=self.context.get("request"), username=email, password=password
            )

            if not user:
                raise serializers.ValidationError("The passwords don’t match.")

            if not user.is_active:
                raise serializers.ValidationError("User account is disabled.")

            if not user.is_email_verified:
                raise serializers.ValidationError(
                    "Please verify your email address first."
                )

            attrs["user"] = user
            return attrs
        else:
            raise serializers.ValidationError("Must include email and password.")


class EmailVerificationSerializer(serializers.Serializer):
    token = serializers.UUIDField()


class ResendVerificationSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        try:
            User.objects.get(email=value)
        except User.DoesNotExist:
            raise serializers.ValidationError("Email not found.")
        return value


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.UUIDField()
    password = serializers.CharField(validators=[validate_password])
    password_confirm = serializers.CharField()

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError("Passwords don't match.")
        return attrs


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "is_email_verified", "date_joined", "profile_image"]
        read_only_fields = ["id", "is_email_verified", "date_joined"]
