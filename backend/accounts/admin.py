from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, EmailVerificationToken, PasswordResetToken


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = [
        "email",
        "is_email_verified",
        "is_active",
        "is_staff",
        "date_joined",
    ]
    list_filter = ["is_email_verified", "is_active", "is_staff", "is_superuser"]
    search_fields = ["email"]
    ordering = ["-date_joined"]

    # BaseUserAdmin의 fieldsets을 오버라이드하여 username 관련 필드 제거
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        # ("Personal info", {"fields": ("first_name", "last_name")}),
        (
            "Permissions",
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                ),
            },
        ),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
        ("Email Verification", {"fields": ("is_email_verified",)}),
    )

    # 사용자 생성/수정 시 사용할 필드셋
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "password1", "password2"),
            },
        ),
    )


@admin.register(EmailVerificationToken)
class EmailVerificationTokenAdmin(admin.ModelAdmin):
    list_display = ["user", "token", "created_at", "expires_at", "is_used"]
    list_filter = ["is_used", "created_at"]
    search_fields = ["user__email"]
    readonly_fields = ["token", "created_at", "expires_at"]


@admin.register(PasswordResetToken)
class PasswordResetTokenAdmin(admin.ModelAdmin):
    list_display = ["user", "token", "created_at", "expires_at", "is_used"]
    list_filter = ["is_used", "created_at"]
    search_fields = ["user__email"]
    readonly_fields = ["token", "created_at", "expires_at"]
