from __future__ import annotations

import json
from datetime import date

from rest_framework import serializers

from culture_centers.models import CultureCenter
from teacher_applications.models import TeacherApplication, ApplicationStatusChoices

from .models import (
    DispatchRequest,
    DispatchApplication,
    DispatchAssignment,
    DispatchRequestStatus,
    DispatchApplicationStatus,
    WeekdayChoices,
)


class CultureCenterBriefSerializer(serializers.ModelSerializer):
    center_name = serializers.CharField(source="center.name", read_only=True)
    region_name = serializers.CharField(source="region.name", read_only=True)

    class Meta:
        model = CultureCenter
        fields = (
            "id",
            "center",
            "center_name",
            "region",
            "region_name",
            "branch_name",
            "address_detail",
            "center_phone",
            "manager_name",
            "manager_phone",
            "manager_email",
        )


class DispatchRequestSerializer(serializers.ModelSerializer):
    culture_center_detail = CultureCenterBriefSerializer(
        source="culture_center", read_only=True
    )
    requested_by_email = serializers.EmailField(
        source="requested_by.email", read_only=True
    )
    applications_count = serializers.IntegerField(read_only=True)
    is_applied = serializers.BooleanField(read_only=True)

    weekdays = serializers.ListField(
        child=serializers.ChoiceField(choices=WeekdayChoices.choices),
        allow_empty=False,
    )

    class Meta:
        model = DispatchRequest
        fields = (
            "id",
            "culture_center",
            "culture_center_detail",
            "requested_by",
            "requested_by_email",
            "teaching_language",
            "course_title",
            "weekdays",
            "start_time",
            "end_time",
            "start_date",
            "end_date",
            "target",
            "level",
            "headcount",
            "is_online",
            "requirements",
            "notes",
            "requester_name",
            "requester_phone",
            "requester_email",
            "status",
            "published_at",
            "application_deadline",
            "applications_count",
            "is_applied",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "requested_by",
            "requested_by_email",
            "status",
            "published_at",
            "applications_count",
            "is_applied",
            "created_at",
            "updated_at",
        )

    def validate_weekdays(self, value):
        # multipart/form-data로 들어오는 경우 문자열로 올 수 있어 파싱
        if value in (None, ""):
            raise serializers.ValidationError("weekdays is required")

        if isinstance(value, str):
            try:
                value = json.loads(value)
            except json.JSONDecodeError:
                raise serializers.ValidationError(
                    "Invalid JSON for weekdays. e.g. ['MON','WED']"
                )

        if not isinstance(value, list) or not value:
            raise serializers.ValidationError("weekdays must be a non-empty list")

        # ChoiceField validation already checks allowed values.
        if len(set(value)) != len(value):
            raise serializers.ValidationError("Duplicate weekdays are not allowed")
        return value

    def validate(self, attrs):
        start_time = attrs.get("start_time") or getattr(
            self.instance, "start_time", None
        )
        end_time = attrs.get("end_time") or getattr(self.instance, "end_time", None)
        if start_time and end_time and end_time <= start_time:
            raise serializers.ValidationError(
                {"end_time": "end_time must be after start_time."}
            )

        start_date = attrs.get("start_date") or getattr(
            self.instance, "start_date", None
        )
        end_date = attrs.get("end_date") or getattr(self.instance, "end_date", None)
        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError(
                {"end_date": "end_date must be >= start_date."}
            )

        deadline = attrs.get("application_deadline") or getattr(
            self.instance, "application_deadline", None
        )
        if deadline and start_date and deadline > end_date:
            # 마감일이 강의 종료일 뒤로 가는 건 보통 실수
            raise serializers.ValidationError(
                {"application_deadline": "deadline must be on/before end_date."}
            )

        return attrs


class DispatchApplicationSerializer(serializers.ModelSerializer):
    teacher_name = serializers.SerializerMethodField(read_only=True)
    teacher_email = serializers.EmailField(
        source="teacher_application.email", read_only=True
    )

    class Meta:
        model = DispatchApplication
        fields = (
            "id",
            "dispatch_request",
            "teacher_application",
            "teacher_name",
            "teacher_email",
            "message",
            "status",
            "created_at",
        )
        read_only_fields = (
            "id",
            "dispatch_request",
            "teacher_application",
            "teacher_name",
            "teacher_email",
            "status",
            "created_at",
        )

    def get_teacher_name(self, obj: DispatchApplication):
        ta = obj.teacher_application
        return f"{ta.first_name} {ta.last_name}".strip()


class DispatchApplicationCreateSerializer(serializers.Serializer):
    message = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        request = self.context.get("request")
        if not request or not request.user or request.user.is_anonymous:
            raise serializers.ValidationError("Authentication required")

        try:
            ta = TeacherApplication.objects.get(user=request.user)
        except TeacherApplication.DoesNotExist:
            raise serializers.ValidationError(
                "Teacher application not found. 이력서를 먼저 제출해주세요."
            )

        if ta.status != ApplicationStatusChoices.ACCEPTED:
            raise serializers.ValidationError(
                "Only ACCEPTED teachers can apply. 승인된 강사만 지원할 수 있습니다."
            )

        return attrs


class DispatchAssignmentSerializer(serializers.ModelSerializer):
    selected_application_detail = DispatchApplicationSerializer(
        source="selected_application", read_only=True
    )

    class Meta:
        model = DispatchAssignment
        fields = (
            "id",
            "dispatch_request",
            "selected_application",
            "selected_application_detail",
            "status",
            "admin_memo",
            "created_at",
        )
        read_only_fields = (
            "id",
            "dispatch_request",
            "selected_application",
            "selected_application_detail",
            "created_at",
        )


class AdminAssignSerializer(serializers.Serializer):
    application_id = serializers.IntegerField()
    admin_memo = serializers.CharField(required=False, allow_blank=True)
