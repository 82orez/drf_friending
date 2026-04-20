from django.contrib import admin

from .models import CourseApplication


@admin.register(CourseApplication)
class CourseApplicationAdmin(admin.ModelAdmin):
    list_display = ("id", "dispatch_request", "teacher", "status", "created_at")
    list_filter = ("status",)
    search_fields = (
        "teacher__first_name",
        "teacher__last_name",
        "teacher__korean_name",
        "dispatch_request__course_title",
    )
