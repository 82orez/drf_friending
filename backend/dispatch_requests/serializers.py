# backend/dispatch_requests/serializers.py
from rest_framework import serializers
from culture_centers.models import CultureCenter
from culture_centers.serializers import CultureCenterBranchSerializer
from .models import DispatchRequest
from teacher_applications.models import TeacherApplication, ApplicationStatusChoices


class DispatchRequestSerializer(serializers.ModelSerializer):
    culture_center_id = serializers.PrimaryKeyRelatedField(
        source="culture_center",
        queryset=CultureCenter.objects.all(),
        write_only=True,
    )
    culture_center = CultureCenterBranchSerializer(read_only=True)

    teacher_name_id = serializers.PrimaryKeyRelatedField(
        source="teacher_name",
        queryset=TeacherApplication.objects.filter(
            status=ApplicationStatusChoices.ACCEPTED
        ),
        write_only=True,
        required=False,
        allow_null=True,
    )

    teacher_name_display = serializers.SerializerMethodField(read_only=True)
    applications_count = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = DispatchRequest
        fields = [
            "id",
            "requester",
            "culture_center",
            "culture_center_id",
            "teaching_language",
            "course_title",
            "instructor_type",
            "teacher_name",
            "teacher_name_id",
            "teacher_name_display",
            "class_days",
            "start_time",
            "end_time",
            "start_date",
            "end_date",
            "applicant_name",
            "applicant_phone",
            "applicant_email",
            "lecture_count",
            "students_count",
            "extra_requirements",
            "notes_for_teachers",
            "application_deadline",
            "published_at",
            "closed_at",
            "status",
            "applications_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "requester",
            "status",
            "published_at",
            "closed_at",
            "applications_count",
            "created_at",
            "updated_at",
            "end_date",
            "teacher_name",
            "teacher_name_display",
        ]

    def get_teacher_name_display(self, obj: DispatchRequest):
        ta = getattr(obj, "teacher_name", None)
        return str(ta) if ta else None

    def get_applications_count(self, obj: DispatchRequest) -> int:
        if hasattr(obj, "_applications_count"):
            return obj._applications_count
        return obj.applications.count()

    def validate(self, attrs):
        start_time = attrs.get("start_time")
        end_time = attrs.get("end_time")
        if start_time and end_time and start_time >= end_time:
            raise serializers.ValidationError("end_time must be after start_time.")

        start_date = attrs.get("start_date")
        end_date = attrs.get("end_date")
        if start_date and end_date and start_date > end_date:
            raise serializers.ValidationError("end_date must be on/after start_date.")

        days = attrs.get("class_days")
        if start_date and days:
            key_to_weekday = {
                "MON": 0,
                "TUE": 1,
                "WED": 2,
                "THU": 3,
                "FRI": 4,
                "SAT": 5,
                "SUN": 6,
            }
            try:
                allowed_weekdays = {key_to_weekday[str(d).upper()] for d in days}
            except Exception:
                allowed_weekdays = set()
            if allowed_weekdays and start_date.weekday() not in allowed_weekdays:
                raise serializers.ValidationError(
                    {"start_date": "start_date weekday must be included in class_days."}
                )

        return attrs


class DispatchRequestAdminSerializer(DispatchRequestSerializer):
    """관리자용 — notes_for_teachers / application_deadline 수정 허용"""

    class Meta(DispatchRequestSerializer.Meta):
        read_only_fields = [
            "id",
            "requester",
            "status",
            "published_at",
            "closed_at",
            "applications_count",
            "created_at",
            "updated_at",
            "end_date",
            "teacher_name",
            "teacher_name_display",
        ]


class ApplySerializer(serializers.Serializer):
    message = serializers.CharField(required=False, allow_blank=True, default="")


class SetApplicationStatusSerializer(serializers.Serializer):
    application_id = serializers.IntegerField(required=True)
    status = serializers.CharField(required=True)
