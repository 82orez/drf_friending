from rest_framework import serializers
from culture_centers.models import CultureCenter
from culture_centers.serializers import CultureCenterBranchSerializer
from .models import DispatchRequest


class DispatchRequestSerializer(serializers.ModelSerializer):
    culture_center_id = serializers.PrimaryKeyRelatedField(
        source="culture_center",
        queryset=CultureCenter.objects.all(),
        write_only=True,
    )
    culture_center = CultureCenterBranchSerializer(read_only=True)

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
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "requester", "status", "created_at", "updated_at"]

    def validate(self, attrs):
        # 모델 clean()과 비슷하게 DRF 레벨에서도 한번 더 방어
        start_time = attrs.get("start_time")
        end_time = attrs.get("end_time")
        if start_time and end_time and start_time >= end_time:
            raise serializers.ValidationError("end_time must be after start_time.")

        start_date = attrs.get("start_date")
        end_date = attrs.get("end_date")
        if start_date and end_date and start_date > end_date:
            raise serializers.ValidationError("end_date must be on/after start_date.")

        return attrs
