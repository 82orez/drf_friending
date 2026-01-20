from rest_framework import serializers

from culture_centers.serializers import CultureCenterBranchSerializer
from teacher_applications.models import TeacherApplication

from .models import Course


class CourseSerializer(serializers.ModelSerializer):
    culture_center = CultureCenterBranchSerializer(read_only=True)
    culture_center_id = serializers.PrimaryKeyRelatedField(
        source="culture_center",
        queryset=Course._meta.get_field(
            "culture_center"
        ).remote_field.model.objects.all(),
        write_only=True,
        required=False,
    )

    teacher_display = serializers.CharField(source="teacher.__str__", read_only=True)

    class Meta:
        model = Course
        fields = [
            "id",
            "source_post",
            "culture_center",
            "culture_center_id",
            "teaching_language",
            "course_title",
            "instructor_type",
            "teacher",
            "teacher_display",
            "class_days",
            "start_time",
            "end_time",
            "start_date",
            "end_date",
            "lecture_count",
            "students_count",
            "applicant_name",
            "applicant_phone",
            "applicant_email",
            "extra_requirements",
            "notes",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "end_date",
            "created_at",
            "updated_at",
            "teacher_display",
        ]


class CourseConfirmSerializer(serializers.Serializer):
    """
    body 없이도 동작 가능(SELECTED를 자동 탐색)
    다만 정책적으로 SELECTED가 없을 때를 대비해 teacher_id를 옵션으로 둠
    """

    teacher_id = serializers.IntegerField(required=False)

    def validate_teacher_id(self, value):
        if value is None:
            return value
        if not TeacherApplication.objects.filter(id=value).exists():
            raise serializers.ValidationError("해당 강사 정보가 존재하지 않습니다.")
        return value
