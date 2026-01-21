from django.db import transaction
from rest_framework import serializers

from culture_centers.serializers import CultureCenterBranchSerializer
from dispatch_requests.models import DispatchRequest, DispatchRequestStatusChoices

from .models import CoursePost, CourseApplication


class DispatchRequestSummarySerializer(serializers.ModelSerializer):
    culture_center = CultureCenterBranchSerializer(read_only=True)

    class Meta:
        model = DispatchRequest
        fields = [
            "id",
            "culture_center",
            "teaching_language",
            "course_title",
            "instructor_type",
            "class_days",
            "start_time",
            "end_time",
            "start_date",
            "end_date",
            "lecture_count",
            "students_count",
            "extra_requirements",
        ]


class CourseApplicationSerializer(serializers.ModelSerializer):
    teacher_display = serializers.CharField(source="teacher.__str__", read_only=True)

    class Meta:
        model = CourseApplication
        fields = [
            "id",
            "post",
            "teacher",
            "teacher_display",
            "status",
            "message",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "post",
            "teacher",
            "teacher_display",
            "status",
            "created_at",
            "updated_at",
        ]


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
            "dispatch_request",
            "status",
            "published_at",
            "closed_at",
            "created_by",
            "created_at",
            "updated_at",
            "applications_count",
        ]


class CoursePostCreateSerializer(serializers.ModelSerializer):
    dispatch_request_id = serializers.PrimaryKeyRelatedField(
        source="dispatch_request",
        queryset=DispatchRequest.objects.all(),
        write_only=True,
    )

    class Meta:
        model = CoursePost
        fields = [
            "id",
            "dispatch_request_id",
            "application_deadline",
            "notes_for_teachers",
        ]
        read_only_fields = ["id"]

    def validate(self, attrs):
        dr = attrs.get("dispatch_request")

        if dr and CoursePost.objects.filter(dispatch_request=dr).exists():
            raise serializers.ValidationError(
                "이미 해당 파견요청으로 공고가 생성되어 있습니다."
            )

        # ✅ 정책: 마감/취소된 파견요청에는 공고 생성 불가
        if dr and dr.status in [
            DispatchRequestStatusChoices.CLOSED,
            DispatchRequestStatusChoices.CANCELLED,
        ]:
            raise serializers.ValidationError(
                "마감/취소된 파견요청에는 공고를 생성할 수 없습니다."
            )

        return attrs

    def create(self, validated_data):
        """
        ✅ 한 번의 요청으로 트랜잭션 처리
        - CoursePost 생성
        - DispatchRequest.status -> CONFIRMED
        """
        request = self.context["request"]
        dr_id = validated_data["dispatch_request"].id

        with transaction.atomic():
            # ✅ 동시성 방지: dispatch_request row 락
            dr = DispatchRequest.objects.select_for_update().get(id=dr_id)

            # ✅ 트랜잭션 내에서 다시 한 번 체크(레이스 컨디션 방지)
            if CoursePost.objects.filter(dispatch_request=dr).exists():
                raise serializers.ValidationError(
                    "이미 해당 파견요청으로 공고가 생성되어 있습니다."
                )

            post = CoursePost.objects.create(
                created_by=request.user,
                dispatch_request=dr,
                application_deadline=validated_data.get("application_deadline"),
                notes_for_teachers=validated_data.get("notes_for_teachers", ""),
            )

            # ✅ 공고 생성 성공 시 파견요청 상태를 CONFIRMED로 변경
            if dr.status != DispatchRequestStatusChoices.CONFIRMED:
                dr.status = DispatchRequestStatusChoices.CONFIRMED
                dr.save()  # DispatchRequest.save()에서 full_clean() 유지

        return post


class CoursePostApplySerializer(serializers.Serializer):
    message = serializers.CharField(required=False, allow_blank=True, default="")


class CourseApplicationStatusUpdateSerializer(serializers.Serializer):
    application_id = serializers.IntegerField(required=True)
    status = serializers.CharField(required=True)
