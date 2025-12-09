# applications/serializers.py
from rest_framework import serializers
from .models import TeacherApplication


class TeacherApplicationSerializer(serializers.ModelSerializer):
    """
    Teacher application serializer
    외국인 어학 강사 이력서 지원서 Serializer
    """

    # 파일 필드는 명시적으로 적어주는 게 가독성에 좋음
    profile_image = serializers.ImageField(
        write_only=False,
        required=True,
        help_text="Profile image (max 2MB, JPG/PNG) / 프로필 이미지 (최대 2MB, JPG/PNG)",
    )
    visa_scan = serializers.ImageField(
        write_only=False,
        required=True,
        help_text="Visa copy (max 2MB, JPG/PNG) / 비자 사본 (최대 2MB, JPG/PNG)",
    )

    class Meta:
        model = TeacherApplication
        fields = "__all__"
        read_only_fields = (
            "id",
            "user",
            "status",
            "created_at",
            "updated_at",
        )

    # 동의 항목들 & 기본 필수 체크 커스텀 검증
    def validate(self, attrs):
        errors = {}

        # 필수 동의 항목 강제
        required_true_fields = [
            "consent_personal_data",
            "consent_data_retention",
            "confirmation_info_true",
        ]
        for field in required_true_fields:
            if not attrs.get(field):
                errors[field] = (
                    "This consent is required to submit the application. "
                    "해당 동의는 지원서를 제출하기 위해 반드시 필요합니다."
                )

        # 기본 이미지 필수 확인 (모델에서도 blank=False라서 사실상 자동이지만,
        # 에러 메시지를 더 친절하게 주고 싶을 때 한 번 더 체크)
        if self.instance is None:  # create일 때만
            if not attrs.get("profile_image"):
                errors["profile_image"] = (
                    "Profile image is required. 프로필 이미지는 필수입니다."
                )
            if not attrs.get("visa_scan"):
                errors["visa_scan"] = "Visa copy is required. 비자 사본은 필수입니다."

        if errors:
            raise serializers.ValidationError(errors)

        return attrs
