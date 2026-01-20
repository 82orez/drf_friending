from __future__ import annotations

from rest_framework import serializers

from culture_centers.models import CultureCenter
from teacher_applications.models import TeacherApplication

from course_posts.models import CoursePost
from .models import Course


class CourseSerializer(serializers.ModelSerializer):
    culture_center_branch_name = serializers.CharField(
        source="culture_center_branch.branch_name", read_only=True
    )
    teacher_name = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = [
            "id",
            "source_post",
            "culture_center_branch",
            "culture_center_branch_name",
            "teacher",
            "teacher_name",
            "course_name",
            "start_date",
            "end_date",
            "class_days",
            "class_time",
            "lecture_count",
            "status",
            "manager_name",
            "manager_phone",
            "manager_email",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "end_date", "created_at", "updated_at"]

    def get_teacher_name(self, obj):
        if not obj.teacher:
            return None
        t = obj.teacher
        return (
            f"{t.last_name} {t.first_name}".strip()
            if getattr(t, "last_name", None)
            else f"{t.first_name}".strip()
        )


class ConfirmCourseSerializer(serializers.Serializer):
    """
    공고(source_post) 기반으로 Course를 생성/확정할 때 사용
    """

    teacher_application_id = serializers.IntegerField(required=True)

    def validate_teacher_application_id(self, value):
        # TeacherApplication 존재 여부만 체크
        if not TeacherApplication.objects.filter(id=value).exists():
            raise serializers.ValidationError("해당 강사 정보가 존재하지 않습니다.")
        return value
