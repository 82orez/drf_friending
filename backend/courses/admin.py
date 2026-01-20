from django.contrib import admin
from .models import Course


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "status",
        "course_name",
        "culture_center_branch",
        "teacher",
        "start_date",
        "end_date",
        "created_at",
    )
    list_filter = ("status",)
    search_fields = ("course_name", "culture_center_branch__branch_name")
