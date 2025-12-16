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
    readonly_fields = ["user", "created_at", "updated_at"]

    fieldsets = (
        (
            "기본 정보",
            {
                "fields": (
                    "user",
                    "profile_image",
                    "first_name",
                    "last_name",
                    "korean_name",
                    "gender",
                    "date_of_birth",
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
                "classes": ["collapse"],
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
                "classes": ["collapse"],
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
                ),
                "classes": ("collapse",),  # 접을 수 있도록
            },
        ),
        ("관리 정보", {"fields": ("status", "created_at", "updated_at")}),
    )

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
