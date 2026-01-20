from __future__ import annotations

from rest_framework import serializers

from dispatch_requests.models import DispatchRequest
from teacher_applications.models import TeacherApplication

from .models import (
    CoursePost,
    CourseApplication,
    CoursePostStatusChoices,
    CourseApplicationStatusChoices,
)


class DispatchRequestSummarySerializer(serializers.ModelSerializer):
    culture_center_branch_name = serializers.CharField(
        source="culture_center_branch.branch_name", read_only=True
    )
    culture_center_center_name = serializers.CharField(
        source="culture_center_branch.center.center_name", read_only=True
    )
    culture_center_region_name = serializers.CharField(
        source="culture_center_branch.region.region_name", read_only=True
    )

    class Meta:
        model = DispatchRequest
        fields = [
            "id",
            "course_name",
            "start_date",
            "end_date",
            "class_days",
            "class_time",
            "lecture_count",
            "culture_center_branch",
            "culture_center_region_name",
            "culture_center_center_name",
            "culture_center_branch_name",
        ]


class TeacherSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = TeacherApplication
        fields = [
            "id",
            "first_name",
            "last_name",
            "korean_name",
            "teaching_language",
            "available_time_slots",
        ]


class CourseApplicationSerializer(serializers.ModelSerializer):
    teacher = TeacherSummarySerializer(read_only=True)

    class Meta:
        model = CourseApplication
        fields = [
            "id",
            "post",
            "teacher",
            "status",
            "message",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "teacher", "created_at", "updated_at"]


class CoursePostSerializer(serializers.ModelSerializer):
    dispatch_request = DispatchRequestSummarySerializer(read_only=True)
    applications_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = CoursePost
        fields = [
            "id",
            "dispatch_request",
            "status",
            "application_deadline",
            "published_at",
            "closed_at",
            "notes_for_teachers",
            "created_by",
            "created_at",
            "updated_at",
            "applications_count",
        ]
        read_only_fields = [
            "id",
            "published_at",
            "closed_at",
            "created_by",
            "created_at",
            "updated_at",
            "applications_count",
        ]


class CoursePostCreateSerializer(serializers.ModelSerializer):
    dispatch_request_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = CoursePost
        fields = [
            "id",
            "dispatch_request_id",
            "application_deadline",
            "notes_for_teachers",
        ]
        read_only_fields = ["id"]

    def validate_dispatch_request_id(self, value):
        if CoursePost.objects.filter(dispatch_request_id=value).exists():
            raise serializers.ValidationError(
                "이미 해당 파견요청으로 공고가 생성되어 있습니다."
            )
        return value

    def create(self, validated_data):
        dr_id = validated_data.pop("dispatch_request_id")
        request = self.context["request"]
        post = CoursePost.objects.create(
            dispatch_request_id=dr_id,
            created_by=request.user if request.user.is_authenticated else None,
            **validated_data,
        )
        return post
