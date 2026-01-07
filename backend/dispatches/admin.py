from django.contrib import admin

from .models import DispatchRequest, DispatchApplication, DispatchAssignment


@admin.register(DispatchRequest)
class DispatchRequestAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "status",
        "culture_center",
        "teaching_language",
        "course_title",
        "start_date",
        "end_date",
        "created_at",
    )
    list_filter = ("status", "teaching_language", "culture_center")
    search_fields = (
        "course_title",
        "culture_center__branch_name",
        "culture_center__center__name",
        "requester_name",
        "requester_email",
    )


@admin.register(DispatchApplication)
class DispatchApplicationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "status",
        "dispatch_request",
        "teacher_application",
        "created_at",
    )
    list_filter = ("status",)
    search_fields = (
        "dispatch_request__course_title",
        "teacher_application__first_name",
        "teacher_application__last_name",
        "teacher_application__email",
    )


@admin.register(DispatchAssignment)
class DispatchAssignmentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "status",
        "dispatch_request",
        "selected_application",
        "created_at",
    )
    list_filter = ("status",)
