from django.contrib import admin
from django.utils.html import format_html
from .models import TeacherApplication


@admin.register(TeacherApplication)
class TeacherApplicationAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "full_name",
        "email",
        "nationality",
        "visa_type",
        "status",
        "visa_status",
        "created_at",
    ]
    list_filter = [
        "status",
        "visa_type",
        "nationality",
        "teaching_languages",
        "created_at",
    ]
    search_fields = [
        "first_name",
        "last_name",
        "email",
        "phone_number",
        "nationality",
    ]
    readonly_fields = ["user", "created_at", "updated_at", "profile_image_preview"]

    fieldsets = (
        (
            "기본 정보",
            {
                "fields": (
                    "user",
                    "profile_image",
                    "profile_image_preview",
                    "first_name",
                    "last_name",
                    "korean_name",
                    "gender",
                    "date_of_birth",
                    "nationality",
                    "native_language",
                )
            },
        ),
        (
            "연락처 정보",
            {
                "fields": (
                    "email",
                    "phone_number",
                    "address_line1",
                    "city",
                    "district",
                    "postal_code",
                )
            },
        ),
        ("비자 정보", {"fields": ("visa_type", "visa_expiry_date", "visa_scan")}),
        (
            "강의 정보",
            {
                "fields": (
                    "teaching_languages",
                    "preferred_subjects",
                    "total_teaching_experience_years",
                    "korea_teaching_experience_years",
                )
            },
        ),
        (
            "이력서 내용",
            {
                "fields": (
                    "self_introduction",
                    "education_history",
                    "experience_history",
                    "certifications",
                ),
            },
        ),
        (
            "근무 조건",
            {
                "fields": (
                    "employment_type",
                    "preferred_locations",
                    "available_time_slots",
                    "available_from_date",
                ),
            },
        ),
        (
            "동의 항목",
            {
                "fields": (
                    "consent_personal_data",
                    "consent_data_retention",
                    "consent_third_party_sharing",
                    "confirmation_info_true",
                )
            },
        ),
        (
            "관리자 전용 / Admin Only",
            {
                "fields": (
                    "memo",
                    "evaluation_result",
                    "introduction_youtube_url",
                ),
            },
        ),
        ("관리 정보", {"fields": ("status", "created_at", "updated_at")}),
    )

    def profile_image_preview(self, obj):
        if not obj or not getattr(obj, "profile_image", None):
            return "이미지 없음"
        try:
            return format_html(
                '<img src="{}" style="max-height: 120px; max-width: 120px; border-radius: 8px; object-fit: cover;" />',
                obj.profile_image.url,
            )
        except Exception:
            return "미리보기 불가"

    profile_image_preview.short_description = "Profile image preview"

    def full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}"

    full_name.short_description = "Name"

    def visa_status(self, obj):
        if obj.visa_expiry_date:
            from datetime import date

            days_left = (obj.visa_expiry_date - date.today()).days
            if days_left < 0:
                return format_html('<span style="color: red;">만료됨</span>')
            elif days_left <= 90:
                return format_html('<span style="color: orange;">곧 만료</span>')
            else:
                return format_html('<span style="color: green;">유효함</span>')
        return "정보 없음"

    visa_status.short_description = "비자 상태"
