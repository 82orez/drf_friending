from django.contrib import admin

from .models import Course


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "status",
        "course_title",
        "teaching_language",
        "culture_center",
        "teacher",
        "start_date",
        "end_date",
        "created_at",
    )
    list_filter = ("status", "teaching_language")
    search_fields = ("course_title", "culture_center__branch_name")
