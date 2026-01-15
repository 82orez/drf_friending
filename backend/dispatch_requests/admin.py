from django.contrib import admin
from .models import DispatchRequest


@admin.register(DispatchRequest)
class DispatchRequestAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "culture_center",
        "teaching_language",
        "course_title",
        "status",
        "applicant_name",
        "created_at",
    )
    list_filter = ("status", "teaching_language", "culture_center__center__name")
    search_fields = ("course_title", "applicant_name", "applicant_email")
    readonly_fields = ("created_at", "updated_at", "requester")
