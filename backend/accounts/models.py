import uuid
from django.contrib.auth.models import (
    AbstractBaseUser,
    PermissionsMixin,
    BaseUserManager,
)
from django.db import models
from django.utils import timezone
from datetime import timedelta
from django.conf import settings


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("이메일은 필수입니다.")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser는 is_staff=True 여야 합니다.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser는 is_superuser=True 여야 합니다.")
        return self._create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(
        unique=True,
        error_messages={
            "unique": "An account with this email already exists. Please sign in."
        },
    )
    is_email_verified = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)
    profile_image = models.ImageField(
        upload_to="profile_images/",
        blank=True,
        null=True,
    )

    objects = UserManager()

    USERNAME_FIELD = "email"  # 로그인 식별자
    REQUIRED_FIELDS = []  # createsuperuser 시 추가로 묻는 필드 없음

    def __str__(self):
        return self.email


class EmailVerificationToken(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="email_tokens"
    )
    token = models.UUIDField(default=uuid.uuid4, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)

    def save(self, *args, **kwargs):
        if not self.expires_at:
            expires_hours = getattr(
                settings, "EMAIL_VERIFICATION_TOKEN_EXPIRES_HOURS", 24
            )
            self.expires_at = timezone.now() + timedelta(hours=expires_hours)
        super().save(*args, **kwargs)

    def is_expired(self):
        return timezone.now() > self.expires_at

    def __str__(self):
        return f"Email verification token for {self.user.email}"


class PasswordResetToken(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="password_reset_tokens"
    )
    token = models.UUIDField(default=uuid.uuid4, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(hours=1)
        super().save(*args, **kwargs)

    def is_expired(self):
        return timezone.now() > self.expires_at

    def __str__(self):
        return f"Password reset token for {self.user.email}"
