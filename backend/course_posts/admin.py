from django.contrib import admin
from .models import CoursePost, CourseApplication


@admin.register(CoursePost)
class CoursePostAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "status",
        "dispatch_request",
        "published_at",
        "application_deadline",
        "closed_at",
        "created_at",
    )
    list_filter = ("status",)
    search_fields = (
        "dispatch_request__course_name",
        "dispatch_request__culture_center_branch__branch_name",
    )


@admin.register(CourseApplication)
class CourseApplicationAdmin(admin.ModelAdmin):
    list_display = ("id", "post", "teacher", "status", "created_at")
    list_filter = ("status",)
    search_fields = (
        "teacher__first_name",
        "teacher__last_name",
        "teacher__korean_name",
        "post__dispatch_request__course_name",
    )
