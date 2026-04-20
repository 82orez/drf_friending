from rest_framework import serializers

from .models import CourseApplication


class CourseApplicationSerializer(serializers.ModelSerializer):
    teacher_display = serializers.StringRelatedField(source="teacher", read_only=True)

    class Meta:
        model = CourseApplication
        fields = [
            "id",
            "dispatch_request",
            "teacher",
            "teacher_display",
            "status",
            "message",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "dispatch_request",
            "teacher",
            "teacher_display",
            "status",
            "created_at",
            "updated_at",
        ]


class CourseApplicationApplySerializer(serializers.Serializer):
    message = serializers.CharField(required=False, allow_blank=True, default="")


class CourseApplicationStatusUpdateSerializer(serializers.Serializer):
    application_id = serializers.IntegerField(required=True)
    status = serializers.CharField(required=True)
